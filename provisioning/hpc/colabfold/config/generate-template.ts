/**
 * config.template.ymlを該当環境の値で置換しconfig.ymlを生成するスクリプト
 */

import * as fs from 'fs'
import * as path from 'path'
import * as aws from 'aws-sdk'

const CDK_ENV = process.env.CDK_ENV ? `-${process.env.CDK_ENV}` : ''

const REGION = 'us-east-1'
const CFN_STACK_NAME = `Alphafold2ServiceStack${CDK_ENV}`

async function getProvisionedEnv() {
  const cfn = new aws.CloudFormation({ region: REGION })
  const stacks = await cfn.describeStacks().promise()

  const stack = stacks.Stacks?.find((stack) => {
    return stack.StackName == CFN_STACK_NAME
  })

  const sshKeyName = stack?.Outputs?.find((output) => {
    return output.OutputKey == 'SshKeyName'
  })?.OutputValue

  const publicSubnetId0 = stack?.Outputs?.find((output) => {
    return output.OutputKey == 'PublicSubnetIds0'
  })?.OutputValue

  const privateSubnetId0 = stack?.Outputs?.find((output) => {
    return output.OutputKey == 'PrivateSubnetIds0'
  })?.OutputValue

  const bucketName = stack?.Outputs?.find((output) => {
    return output.OutputKey == 'HpcBucketName'
  })?.OutputValue

  const fsxId = stack?.Outputs?.find((output) => {
    return output.OutputKey == 'FsxFileSystemId'
  })?.OutputValue

  const AuroraCredentialSecretArn = stack?.Outputs?.find((output) => {
    return output.OutputKey == 'AuroraCredentialSecretArn'
  })?.OutputValue

  const AuroraPasswordArn = stack?.Outputs?.find((output) => {
    return output.OutputKey == 'AuroraPasswordArn'
  })?.OutputValue
  
  const HeadNodeSg = stack?.Outputs?.find((output) => {
    return output.OutputKey == 'HeadNodeSecurityGroup'
  })?.OutputValue

  const sm = new aws.SecretsManager({ region: REGION })
  const secretVal = await sm.getSecretValue({ SecretId: AuroraCredentialSecretArn! }).promise()
  const s = JSON.parse(secretVal.SecretString!)

  return {
    sshKeyName,
    publicSubnetId0,
    privateSubnetId0,
    bucketName,
    fsxId,
    dbHost: s.host,
    dbPort: s.port,
    dbUser: s.username,
    dbPass: s.password,
    dbName: s.dbname,
    AuroraPasswordArn,
    HeadNodeSg
  }
}

class SlurmConfigFileGenerator {
  constructor(
    private sshKeyName: string,
    private publicSubnetId: string,
    private privateSubnetId: string,
    private bucketName: string,
    private dbHost: string,
    private dbPort: string,
    private dbUser: string,
    private dbPass: string,
    private fsxId: string,
    private AuroraPasswordArn: string,
    private HeadNodeSg: string
  ) {}

  generate(props: { templatePath: string; outputPath: string }) {
    const template = fs
      .readFileSync(props.templatePath, 'utf8')
      .replace(new RegExp('\\${SSH_KEY_NAME}', 'g'), this.sshKeyName)
      .replace(new RegExp('\\${PUBLIC_SUBNET}', 'g'), this.publicSubnetId)
      .replace(new RegExp('\\${PRIVATE_SUBNET}', 'g'), this.privateSubnetId)
      .replace(new RegExp('\\${BUCKET_NAME}', 'g'), this.bucketName)
      .replace(
        new RegExp('\\${POST_INSTALL_SCRIPT_LOCATION}', 'g'),
        `s3://${this.bucketName}/colabfold/scripts/bin/post_install.sh`
      )
      .replace(new RegExp('\\${PCLUSTER_RDS_HOST}', 'g'), this.dbHost)
      .replace(new RegExp('\\${PCLUSTER_RDS_PORT}', 'g'), this.dbPort)
      .replace(new RegExp('\\${PCLUSTER_RDS_USER}', 'g'), this.dbUser)
      .replace(new RegExp('\\${PCLUSTER_RDS_PASS}', 'g'), this.dbPass)
      .replace(new RegExp('\\${PCLUSTER_NAME}', 'g'), 'hpccluster')
      .replace(new RegExp('\\${REGION}', 'g'), REGION)
      .replace(new RegExp('\\${FSX_NAME}', 'g'), this.fsxId)
      .replace(new RegExp('\\${AURORA_PASSWORD_ARN}', 'g'), this.AuroraPasswordArn)
      .replace(new RegExp('\\${FSX_NAME}', 'g'), this.fsxId)
      .replace(new RegExp('\\${HEADNODE_SG}', 'g'), this.HeadNodeSg)

    try {
      fs.writeFileSync(props.outputPath, template)
    } catch (err) {
      console.error(err)
    }
  }
}

async function main() {
  const env = await getProvisionedEnv()

  const generator = new SlurmConfigFileGenerator(
    env.sshKeyName!,
    env.publicSubnetId0!,
    env.privateSubnetId0!,
    env.bucketName!,
    env.dbHost,
    env.dbPort,
    env.dbUser,
    env.dbPass,
    env.fsxId!,
    env.AuroraPasswordArn!,
    env.HeadNodeSg!
  )
  generator.generate({
    templatePath: path.join(__dirname, 'config.template.yml'),
    outputPath: path.join(__dirname, 'config.yml')
  })
}

main()
