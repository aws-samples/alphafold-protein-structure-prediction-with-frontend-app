import * as path from 'path'
import {
  RemovalPolicy,
  Stack,
  StackProps,
  SecretValue,
  Duration,
  CfnOutput,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_secretsmanager as secretsmanager,
  aws_rds as rds,
  aws_ec2 as ec2,
  aws_fsx as fsx
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

const CDK_ENV = process.env.CDK_ENV ? `-${process.env.CDK_ENV}` : ''

export class Alphafold2ServiceStack extends Stack {
  readonly bucket: s3.Bucket

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // HPC を配置する VPC を作成
    const hpcVpc = new ec2.Vpc(this, 'HpcVpc', {
      maxAzs: 2
    })

    // パブリックサブネットを取得
    const publicSubnets = hpcVpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC
    })

    // プライベートサブネットを取得
    const privateSubnets = hpcVpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
    })

    // キーペア作成
    const keyName = `keypair-alphafold2${CDK_ENV}`
    const keyPair = new ec2.CfnKeyPair(this, keyName, {
      keyName: keyName
    })
    keyPair.applyRemovalPolicy(RemovalPolicy.DESTROY)

    // キーペア取得コマンドを出力
    new CfnOutput(this, 'GetSSHKeyCommand', {
      value: `aws ssm get-parameter --name /ec2/keypair/${keyPair.getAtt('KeyPairId')} --region ${
        this.region
      } --with-decryption --query Parameter.Value --output text > ~/.ssh/${keyName}.pem`
    })

    // Aurora 用のセキュリティグループを作成
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: hpcVpc
    })
    databaseSecurityGroup.addIngressRule(ec2.Peer.ipv4(hpcVpc.vpcCidrBlock), ec2.Port.tcp(3306))

    // Aurora 用の Credential 情報を Secrets Manager に生成
    const auroraCredentialSecret = new secretsmanager.Secret(this, 'AuroraCredentialSecret', {
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        secretStringTemplate: JSON.stringify({
          username: 'hpc'
        }),
        generateStringKey: 'password'
      }
    })

    // Aurora のパスワードを保存
    const auroraPassword = new secretsmanager.Secret(this, 'AuroraPassword', {
      secretStringValue: SecretValue.unsafePlainText(
        auroraCredentialSecret.secretValueFromJson('password').unsafeUnwrap()
      )
    })

    // Aurora Serverless v1 クラスタを作成
    const auroraCluseter = new rds.ServerlessCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      vpc: hpcVpc,
      credentials: rds.Credentials.fromSecret(auroraCredentialSecret),
      securityGroups: [databaseSecurityGroup],
      scaling: {
        // 最小 ACU: 1
        minCapacity: 1,
        // 最大 ACU: 2
        maxCapacity: 2,
        // 一時停止までに必要な非アクティブ時間: 2時間
        autoPause: Duration.hours(2)
      },
      // Data API を有効化
      enableDataApi: true,
      removalPolicy: RemovalPolicy.DESTROY
    })

    // スクリプトやジョブの実行結果を配置する S3 バケットを作成
    this.bucket = new s3.Bucket(this, 'HpcBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*']
        }
      ]
    })

    // スクリプトのアップロード
    new s3deploy.BucketDeployment(this, 'HpcScriptS3Deploy', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', 'hpc', 'colabfold', 'scripts'), {})],
      destinationBucket: this.bucket,
      destinationKeyPrefix: 'colabfold/scripts/'
    })

    // クラスター設定ファイルのアップロード
    new s3deploy.BucketDeployment(this, 'HpcConfigS3Deploy', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', 'hpc', 'colabfold', 'config'), {})],
      destinationBucket: this.bucket,
      destinationKeyPrefix: 'colabfold/config/'
    })
    
    // AF2 スクリプトのアップロード
    new s3deploy.BucketDeployment(this, 'Af2ScriptS3Deploy', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', 'hpc', 'alphafold2', 'scripts'), {})],
      destinationBucket: this.bucket,
      destinationKeyPrefix: 'alphafold2/scripts/'
    })

    // AF2 クラスター設定ファイルのアップロード
    new s3deploy.BucketDeployment(this, 'Af2ConfigS3Deploy', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', 'hpc', 'alphafold2', 'config'), {})],
      destinationBucket: this.bucket,
      destinationKeyPrefix: 'alphafold2/config/'
    })

    // FSx のセキュリティグループを作成
    const sharedStorageSecurityGroup = new ec2.SecurityGroup(this, 'SharedStorageSecurityGroup', {
      vpc: hpcVpc
    })
    sharedStorageSecurityGroup.addIngressRule(ec2.Peer.ipv4(hpcVpc.vpcCidrBlock), ec2.Port.allTcp())

    // Lustre ファイルシステムを作成
    const lustre = new fsx.LustreFileSystem(this, 'AlphaFold2-shared-storage-lustre', {
      lustreConfiguration: {
        deploymentType: fsx.LustreDeploymentType.PERSISTENT_2,
        perUnitStorageThroughput: 125,
        dataCompressionType: fsx.LustreDataCompressionType.LZ4
      },
      vpc: hpcVpc,
      vpcSubnet: hpcVpc.privateSubnets[0],
      securityGroup: sharedStorageSecurityGroup,
      storageCapacityGiB: 2400,
      removalPolicy: RemovalPolicy.DESTROY
    })

    // 構築したリソースの情報を CloudFormation に出力
    new CfnOutput(this, 'VpcId', {
      value: hpcVpc.vpcId
    })

    new CfnOutput(this, 'SshKeyName', {
      value: keyName
    })

    publicSubnets.subnetIds.map((subnetId, index) => {
      return new CfnOutput(this, `PublicSubnetIds-${index}`, {
        value: subnetId
      })
    })

    privateSubnets.subnetIds.map((subnetId, index) => {
      return new CfnOutput(this, `PrivateSubnetIds-${index}`, {
        value: subnetId
      })
    })

    new CfnOutput(this, 'HpcBucketName', {
      value: this.bucket.bucketName
    })

    new CfnOutput(this, 'FsxFileSystemId', {
      value: lustre.fileSystemId
    })

    new CfnOutput(this, 'AuroraCredentialSecretArn', {
      value: auroraCredentialSecret.secretArn
    })

    new CfnOutput(this, 'AuroraPasswordArn', {
      value: auroraPassword.secretArn
    })
  }
}
