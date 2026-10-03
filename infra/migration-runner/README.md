# One-time database migration runner

A temporary mechanism, not an application component. It exists because the
media database is private and must stay that way: no public address, and a
security group admitting one security group on 5432 and nothing else. Reaching
it means running inside the VPC.

This is the mechanism for schema changes. To run the app itself against the dev
data you want the other one — a temporary bastion and an SSM port-forward, in
`docs/dev-database.md`. No bastion exists at rest; one is created and destroyed
around the work that needs it.

## Why it is not part of the app

Nothing here is wired into startup, and the processing worker never migrates on
its own. A process that alters a schema whenever it happens to boot is how
production schemas get changed by accident.

## What it does

1. Reads `DATABASE_URL` from Secrets Manager at runtime — never from an
   environment variable, a stack output or a committed file.
2. Creates the target database if it is missing. PostgreSQL has no
   `CREATE DATABASE IF NOT EXISTS` and the statement cannot run inside a
   transaction, so the duplicate-database error is the idempotency check.
3. Runs `prisma migrate deploy`. Never `reset`, never `push`.
4. Runs `prisma migrate status`.
5. Asserts the expected tables exist, rather than inferring it from the
   migration log.

Connection strings are masked in everything it returns.

## Running it

    ./infra/migration-runner/build.sh

Then create a Lambda from `infra/dist/migration-runner.zip`:

  - runtime `nodejs22.x`, architecture `arm64`, timeout 600s, memory 1024 MB
  - attached to the VPC's isolated subnets and the security group the database
    admits
  - `MEDIA_DATABASE_SECRET_ARN` set to the secret holding `DATABASE_URL`
  - a role with `AWSLambdaVPCAccessExecutionRole` and `GetSecretValue` on that
    one secret ARN, and nothing else
  - an interface VPC endpoint for Secrets Manager, because isolated subnets have
    no route to the internet

Invoke once, confirm every step reports ok, then delete the function, the role
and the endpoint. Re-running is safe — it reports "already existed" and "No
pending migrations to apply" — but it is not meant to stay.

## Why the bundle carries two engines

`migrate deploy` needs the schema engine, which the generated client does not
include. Both are fetched for `linux-arm64-openssl-3.0.x`; the developer's
darwin engines are excluded, since they are ~35 MB that can never run on Lambda.
