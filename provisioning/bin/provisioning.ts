import * as cdk from 'aws-cdk-lib'
import { Alphafold2ServiceStack } from '../stacks/alphafold2-service-stack'
import { FrontendStack } from '../stacks/frontend-stack'

const CDK_ENV = process.env.CDK_ENV ? `-${process.env.CDK_ENV}` : ''

const app = new cdk.App()
const alphafold = new Alphafold2ServiceStack(app, `Alphafold2ServiceStack${CDK_ENV}`, {
  env: {
    region: 'us-east-1'
  }
})

const frontend = new FrontendStack(app, `FrontendStack${CDK_ENV}`, {
  env: {
    region: 'us-east-1'
  },
  ssmInstanceId: 'your-headnode-instanceid',
  ssmCommandUsername: 'ubuntu',
  storageBucketName: alphafold.bucket.bucketName
})
