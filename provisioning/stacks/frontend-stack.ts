import * as path from 'path'
import {
  RemovalPolicy,
  Stack,
  StackProps,
  SecretValue,
  Duration,
  CfnOutput,
  aws_s3 as s3,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3_deployment as s3deploy,
  aws_rds as rds,
  aws_cloudfront as cloudfront,
  aws_ec2 as ec2,
  aws_fsx as fsx
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha'
import { RestApi } from './constructs/rest-api'

interface FrontendStackProps extends StackProps {
  vpc?: ec2.IVpc
  ssmInstanceId: string
  ssmCommandUsername: string
  storageBucketName: string
}

export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props)

    const apigw = new RestApi(this, 'Api', {
      allowOrigins: ['*']
    })

    const func = new PythonFunction(this, 'ApiHandler', {
      runtime: lambda.Runtime.PYTHON_3_9,
      entry: '../lambda',
      timeout: Duration.seconds(29),
      vpc: props.vpc,
      environment: {
        ALLOW_ORIGIN: '*',
        SSM_INSTANCE_ID: props.ssmInstanceId,
        SSM_COMMAND_USERNAME: props.ssmCommandUsername,
        S3_BUCKET_NAME: props.storageBucketName
      }
    })

    func.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ReadOnlyAccess'))
    func.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'))
    func.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'))

    apigw.addResource('GET', ['{target}', 'jobs'], func)
    apigw.addResource('GET', ['{target}', 'jobs', '{jobId}'], func)
    apigw.addResource('DELETE', ['{target}', 'jobs', '{jobId}'], func)
    apigw.addResource('POST', ['{target}', 'jobs'], func)

    new CfnOutput(this, 'ApiGatewayEndpoint', {
      value: apigw.endpoint
    })

    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    const websiteIdentity = new cloudfront.OriginAccessIdentity(this, 'WebsiteIdentity')
    websiteBucket.grantRead(websiteIdentity)

    const websiteDistribution = new cloudfront.CloudFrontWebDistribution(this, 'WebsiteDistribution', {
      errorConfigurations: [
        {
          errorCachingMinTtl: 300,
          errorCode: 404,
          responseCode: 200,
          responsePagePath: '/index.html'
        }
      ],
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: websiteBucket,
            originAccessIdentity: websiteIdentity
          },
          behaviors: [
            {
              isDefaultBehavior: true
            }
          ]
        }
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL
    })

    const frontendEnvVars = {
      apiEndpoint: apigw.endpoint
    }

    new s3deploy.BucketDeployment(this, 'WebsiteDeploy', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../..', 'app', 'dist')),
        s3deploy.Source.jsonData('env.json', frontendEnvVars)
      ],
      destinationBucket: websiteBucket,
      distribution: websiteDistribution,
      distributionPaths: ['/*'],
      memoryLimit: 1024
    })

    new CfnOutput(this, 'CloudFrontWebDistributionEndpoint', {
      description: 'CloudFrontWebDistributionEndpoint',
      value: websiteDistribution.distributionDomainName
    })
  }
}
