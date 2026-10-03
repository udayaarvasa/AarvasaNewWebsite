# Reaching the dev media database

**There is no bastion.** Every temporary instance created for media QA has been
terminated, along with its instance profile and role. Nothing is listening on
`127.0.0.1:15432`, so the `DATABASE_URL` in `.env.local` will not connect until
you create one.

That is the intended resting state. A standing jump host into a private database
is a standing liability, and the work that needs one is occasional.

## Why there is no simpler route

`aarvasa-media-dev` is private: `PubliclyAccessible: false`, and its security
group (`sg-0c4f3383941e93b02`) admits exactly one source on 5432 —
`sg-0079fd18c7047c8ea`, the group the processing Lambdas use. There is no CIDR
rule, no `0.0.0.0/0` and no SSH anywhere in it.

Reaching it from a laptop therefore means running something inside the VPC that
already holds that group. **Do not** make the instance public, add a CIDR
ingress rule, or open SSH. Those turn a half-hour task into a permanent hole.

Two mechanisms exist, for different jobs:

| Job | Use |
|---|---|
| Apply migrations | `infra/migration-runner` — a one-time Lambda inside the VPC. Reads `DATABASE_URL` from Secrets Manager, never from a file. |
| Run the app against the dev data | A temporary bastion and an SSM port-forward, below. |

## Creating a temporary bastion

Four things, in order. All of it is disposable.

```bash
export AWS_PROFILE=aarvasa-dev AWS_REGION=ap-south-1
```

**1. A role the instance can assume, carrying only SSM.**

```bash
aws iam create-role --role-name aarvasa-media-dev-tunnel \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name aarvasa-media-dev-tunnel \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam create-instance-profile --instance-profile-name aarvasa-media-dev-tunnel
aws iam add-role-to-instance-profile --instance-profile-name aarvasa-media-dev-tunnel \
  --role-name aarvasa-media-dev-tunnel
```

**2. The instance.**

Subnet choice matters and is easy to get wrong. The processing subnets
(`subnet-0c189289c0e329222`, `-09b07eaf2335298c6`, `-0efbdb5c29063b32c`) are
isolated: no internet route, and the VPC endpoints there cover S3, SQS and
Secrets Manager but **not** SSM. An instance in one of them never reaches
Systems Manager and never comes online. Use the default public subnet, which has
an internet gateway route.

```bash
aws ec2 run-instances \
  --image-id "$(aws ssm get-parameter \
      --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
      --query Parameter.Value --output text)" \
  --instance-type t4g.nano \
  --subnet-id subnet-0a324a2f84f913465 \
  --security-group-ids sg-0079fd18c7047c8ea \
  --iam-instance-profile Name=aarvasa-media-dev-tunnel \
  --metadata-options 'HttpTokens=required,HttpEndpoint=enabled' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=aarvasa-media-dev-tunnel},{Key=Purpose,Value=temporary SSM port-forward to the private dev RDS}]'
```

The security group is the Lambdas' own, reused rather than copied: it is already
what the RDS group admits. It belongs to the processing stack — **never delete
it** when cleaning up.

**3. Wait for Systems Manager to see it**, which takes a minute or two.

```bash
aws ssm describe-instance-information \
  --filters "Key=InstanceIds,Values=<instance-id>" \
  --query 'InstanceInformationList[].PingStatus' --output text
```

**4. Forward the port** and leave it running. Needs the
[Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).

```bash
aws ssm start-session --target <instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["aarvasa-media-dev.cl0si0q26a1n.ap-south-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["15432"]}'
```

`.env.local` already points at `127.0.0.1:15432`, so `npm run dev` works once the
session is up. The password is in Secrets Manager under
`aarvasa-media-dev/database`, which holds the whole URL; the app and the worker
use the same credential, including `sslmode=require`.

## Tearing it down

Do this when you are finished. The session ends on its own if the instance goes.

```bash
aws ec2 terminate-instances --instance-ids <instance-id>
aws iam remove-role-from-instance-profile \
  --instance-profile-name aarvasa-media-dev-tunnel --role-name aarvasa-media-dev-tunnel
aws iam delete-instance-profile --instance-profile-name aarvasa-media-dev-tunnel
aws iam detach-role-policy --role-name aarvasa-media-dev-tunnel \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam delete-role --role-name aarvasa-media-dev-tunnel
```

The root volume has `DeleteOnTermination: true`, so it goes with the instance.

Afterwards the database should read `PubliclyAccessible: false` with its single
security-group ingress rule unchanged, and `sg-0079fd18c7047c8ea`, the VPC
endpoints and both processing Lambdas should all still be there. If any of those
changed, something was cleaned up that should not have been.
