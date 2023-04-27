import * as path from 'path'
import {
  RemovalPolicy,
  Stack,
  StackProps,
  SecretValue,
  Duration,
  CfnOutput,
  aws_s3 as s3,
  aws_wafv2 as wafv2,
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
import { GlobalStack } from './global-stack'
import { IPSetConstruct, WAFv2Construct } from './constructs/waf-v2'

interface FrontendStackProps extends StackProps {
  vpc?: ec2.IVpc
  ssmInstanceId: string
  ssmCommandUsername: string
  storageBucketName: string
  globalStack: GlobalStack
  allowIp4Ranges?: string[]
}

export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props)

    const apigw = new RestApi(this, 'Api', {
      allowOrigins: ['*']
    })

    let allowIpV4Set = undefined

    if (props?.allowIp4Ranges !== undefined) {
      const ipSet = new IPSetConstruct(this, 'IpSet', {
        scope: 'REGIONAL',
        allowIp4Ranges: props.allowIp4Ranges
      })

      allowIpV4Set = ipSet.ipSet4
    }

    if (allowIpV4Set !== undefined) {
      const waf = new WAFv2Construct(this, 'IPRestrictionWAFv2', {
        scope: 'REGIONAL',
        allowIp4Set: allowIpV4Set
      })

      new wafv2.CfnWebACLAssociation(this, 'APIGatewayWAFAssociation', {
        webAclArn: waf.arn,
        resourceArn: apigw.resourceArn
      })
    }

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

    const globalWAFv2Arn = props.globalStack.getWAFv2ARN(this, 'GlobalWAFv2ARN')
    const websiteDistribution = new cloudfront.CloudFrontWebDistribution(this, 'WebsiteDistribution', {
      webACLId: globalWAFv2Arn,
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
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enableIpV6: false
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
