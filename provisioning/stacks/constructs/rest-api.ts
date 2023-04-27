import { StackProps } from 'aws-cdk-lib'
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as apiGateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'

interface RestApiProps extends StackProps {
  allowOrigins?: string[]
}

export class RestApi extends Construct {
  public readonly restApi: apiGateway.RestApi
  public readonly endpoint: string
  public readonly resourceArn: string
  public apiKey: apiGateway.IApiKey
  private readonly resources: { [key: string]: apiGateway.IResource }

  constructor(scope: Construct, id: string, props: RestApiProps) {
    super(scope, id)
    this.resources = {}

    const allowOrigins = props?.allowOrigins ?? ['*']

    const apiLogs = new apiGateway.LogGroupLogDestination(
      new logs.LogGroup(this, 'RestApiLogGroup', {
        removalPolicy: cdk.RemovalPolicy.DESTROY
      })
    )

    this.restApi = new apiGateway.RestApi(this, 'RestApi', {
      restApiName: id,
      deployOptions: {
        stageName: 'api',
        accessLogDestination: apiLogs,
        accessLogFormat: apiGateway.AccessLogFormat.jsonWithStandardFields()
      },
      defaultCorsPreflightOptions: {
        allowOrigins: allowOrigins,
        allowMethods: apiGateway.Cors.ALL_METHODS
      },
      endpointConfiguration: {
        types: [apiGateway.EndpointType.REGIONAL]
      }
    })

    this.restApi.addGatewayResponse('Api4xx', {
      type: apiGateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${allowOrigins[0]}'`,
        'Access-Control-Allow-Methods': `'*'`
      }
    })

    this.restApi.addGatewayResponse('Api5xx', {
      type: apiGateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${allowOrigins[0]}'`,
        'Access-Control-Allow-Methods': `'*'`
      }
    })

    const region = cdk.Stack.of(this).region
    const restApiId = this.restApi.restApiId
    const stageName = this.restApi.deploymentStage.stageName

    this.endpoint = `https://${restApiId}.execute-api.${region}.amazonaws.com/${stageName}`
    this.resourceArn = `arn:aws:apigateway:${region}::/restapis/${restApiId}/stages/${stageName}`
  }

  addResource(
    method: string,
    path: string[],
    fn: lambda.IFunction,
    authorizer?: apiGateway.IAuthorizer,
    apiKeyRequired?: boolean
  ): void {
    let resource = this.restApi.root
    let _path = ''

    path.forEach((p) => {
      _path = `${_path}/${p}`
      resource = _path in this.resources ? this.resources[_path] : resource.addResource(p)
      this.resources[_path] = resource
    })

    if (apiKeyRequired && !this.apiKey) {
      this.apiKey = this.restApi.addApiKey('ApiKey', {})
      const plan = this.restApi.addUsagePlan('UsagePlan', {})

      plan.addApiKey(this.apiKey)
      plan.addApiStage({
        stage: this.restApi.deploymentStage
      })
    }

    resource.addMethod(method, new apiGateway.LambdaIntegration(fn), {
      authorizer: authorizer,
      authorizationType: authorizer ? authorizer.authorizationType : undefined,
      apiKeyRequired
    })
  }
}
