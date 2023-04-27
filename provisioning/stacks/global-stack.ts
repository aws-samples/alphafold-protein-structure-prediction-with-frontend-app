import { StackProps, Stack, CfnOutput } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { RemoteOutputs } from 'cdk-remote-stack'
import { WAFv2Construct, IPSetConstruct } from './constructs/waf-v2'

const OUTPUT_PATH_WAF_V2_ARN = 'GlobalWAFv2ARN'

export interface GlobalStackProps extends StackProps {
  wafv2: {
    allowIp4Ranges: string[]
    allowIp6Ranges: string[]
  }
}

export class GlobalStack extends Stack {
  constructor(scope: Construct, id: string, props: GlobalStackProps) {
    super(scope, id, props)

    const allowIpSet = new IPSetConstruct(this, 'IpSet', {
      scope: 'CLOUDFRONT',
      allowIp4Ranges: props.wafv2.allowIp4Ranges,
      allowIp6Ranges: props.wafv2.allowIp6Ranges
    })

    const waf = new WAFv2Construct(this, 'GlobalWaf', {
      scope: 'CLOUDFRONT',
      allowIp4Set: allowIpSet.ipSet4,
      allowIp6Set: allowIpSet.ipSet6
    })

    new CfnOutput(this, OUTPUT_PATH_WAF_V2_ARN, {
      value: waf.arn
    })
  }

  getWAFv2ARN(scope: Stack, id: string): string {
    const outputs = new RemoteOutputs(scope, 'GlobalWAFv2ARNRemoteOutputs', { stack: this })
    const wafArn = outputs.get(OUTPUT_PATH_WAF_V2_ARN)
    return wafArn
  }
}
