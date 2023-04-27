import * as cdk from 'aws-cdk-lib'
import { Alphafold2ServiceStack } from '../stacks/alphafold2-service-stack'
import { FrontendStack } from '../stacks/frontend-stack'
import { GlobalStack } from '../stacks/global-stack'

// Alphafold2ServiceStack dependencies
const c9Eip = 'your-cloud9-ip'

// FrontendStack dependencies
const allowIp4Ranges = ['your-global-ip-v4-cidr']
const ssmInstanceId = 'your-headnode-instanceid'

const CDK_ENV = process.env.CDK_ENV ? `-${process.env.CDK_ENV}` : ''

const app = new cdk.App()
const globalStack = new GlobalStack(app, `GlobalStack${CDK_ENV}`, {
  env: {
    region: 'us-east-1'
  },
  wafv2: {
    allowIp4Ranges: allowIp4Ranges
  }
})

const alphafold = new Alphafold2ServiceStack(app, `Alphafold2ServiceStack${CDK_ENV}`, {
  env: {
    region: 'us-east-1'
  },
  c9Eip: c9Eip
})

const frontend = new FrontendStack(app, `FrontendStack${CDK_ENV}`, {
  env: {
    region: 'us-east-1'
  },
  ssmInstanceId: ssmInstanceId,
  ssmCommandUsername: 'ubuntu',
  storageBucketName: alphafold.bucket.bucketName,
  globalStack: globalStack,
  allowIp4Ranges: allowIp4Ranges
}).addDependency(globalStack)
