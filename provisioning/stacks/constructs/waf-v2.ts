import { aws_wafv2 as waf } from 'aws-cdk-lib'
import { Construct } from 'constructs'

interface IPSetConstructProps {
  scope: 'CLOUDFRONT' | 'REGIONAL'
  allowIp4Ranges: string[]
  allowIp6Ranges?: string[]
}

export class IPSetConstruct extends Construct {
  readonly ipSet4: waf.CfnIPSet
  readonly ipSet6: waf.CfnIPSet

  constructor(scope: Construct, id: string, props: IPSetConstructProps) {
    super(scope, id)

    this.ipSet4 = new waf.CfnIPSet(this, 'IPSetV4', {
      ipAddressVersion: 'IPV4',
      scope: props.scope,
      addresses: props.allowIp4Ranges
    })

    this.ipSet6 = new waf.CfnIPSet(this, 'IPSetV6', {
      ipAddressVersion: 'IPV6',
      scope: props.scope,
      addresses: props.allowIp6Ranges || []
    })
  }
}

interface WAFv2ConstructProps {
  scope: 'CLOUDFRONT' | 'REGIONAL'
  allowIp4Set: waf.CfnIPSet
  allowIp6Set?: waf.CfnIPSet
  addPrototypingManagedRules?: Boolean
}

export class WAFv2Construct extends Construct {
  readonly arn: string

  constructor(scope: Construct, id: string, props: WAFv2ConstructProps) {
    super(scope, id)

    const rules = []

    rules.push({
      priority: 9,
      name: 'WAFv2IpV4RuleSet',
      action: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'WAFv2IpV4RuleSet'
      },
      statement: {
        ipSetReferenceStatement: {
          arn: props.allowIp4Set.attrArn
        }
      }
    })

    if (props.allowIp6Set) {
      rules.push({
        priority: 10,
        name: 'WAFv2IpV6RuleSet',
        action: { allow: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'WAFv2IpV6RuleSet'
        },
        statement: {
          ipSetReferenceStatement: {
            arn: props.allowIp6Set.attrArn
          }
        }
      })
    }

    const webAcl = new waf.CfnWebACL(this, 'WebAcl', {
      defaultAction: { block: {} },
      scope: props.scope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'WebAcl',
        sampledRequestsEnabled: true
      },
      rules: rules
    })

    this.arn = webAcl.attrArn
  }
}
