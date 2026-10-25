# Private database path — runbook

**Status (25 Oct 2026): prepared, not deployed.** The production database still
accepts connections from the internet. Nothing in this document has been run
against production. Do not mark the database private until step 7 is done
and verified.

## Why the database is public today

The site runs on Amplify Hosting. Amplify's server-side compute cannot join a
VPC, so the only way it can reach RDS is over the public endpoint. The database
also sits in a different region (us-east-1) from the Amplify compute
(us-west-2), so every query crosses regions today.

Locking the database down therefore needs a runtime that *can* sit in the VPC.
Tightening the security group alone would take the site offline.

## What reaches the database

| Consumer | How | After cutover |
| --- | --- | --- |
| Production site (Amplify, `main`) | `DATABASE_URL` branch variable, role `aarvasa_app`, TLS | Replaced by the container runtime below |
| Preview (`release/2026-10-20`) | Fail-closed URL since 25 Oct; no database | Unchanged (needs its own database, not production's) |
| Schema changes / admin scripts | Run by an operator from a workstation over the public endpoint | Via SSM port-forward from a temporary task/instance in the VPC (see docs/dev-database.md for the pattern) |
| Mobile app API (`/api/mobile/*`) | Same Next.js app | Moves with the site |

No scheduled job, Lambda or other service reads the production database.

## The replacement path

`infra/src/stacks/app-runtime-prod-stack.ts` (synth-tested in
`infra/test/app-runtime-prod.test.ts`, deployed by an operator only):

```
CloudFront ── ALB (only CloudFront's origin-facing prefix list) ── ECS Fargate tasks
                                                                    │  public subnets, public IPs
                                                                    │  (outbound to Google, Gemini,
                                                                    │   Cloudinary — no NAT gateway)
                                                                    └── RDS :5432 from the task SG only
```

- Same Next.js app, built from the `Dockerfile` (`NEXT_OUTPUT=standalone`).
  The standalone bundle was run locally against an isolated database and passed
  the full moderation e2e (14/14) on 25 Oct 2026.
- `DATABASE_URL` comes from the existing restricted `aarvasa_app` secret
  (`url` field). Every other runtime setting comes from one new secret,
  `aarvasa/prod/web/app-config` (keys: `APP_CONFIG_SECRET_KEYS` in the stack).
- CloudFront caching is disabled, so no response (and no session cookie) can be
  replayed across visitors.
- The stack only **adds** one database ingress rule (task SG → 5432). It never
  edits or removes existing rules and never touches the instance.

Indicative cost (us-east-1, on-demand): two 0.5 vCPU / 1 GB tasks ≈ $36/month,
ALB ≈ $18/month plus LCUs, CloudFront per request/GB, ECR storage pennies.
Amplify charges stop after decommission.

## Cutover

Each step has a check; stop at the first that fails. Production keeps running
on Amplify until step 6.

1. **Secret.** Create `aarvasa/prod/web/app-config` (JSON) with the values the
   Amplify `main` branch uses today, keeping the same `AUTH_SECRET` so existing
   sessions stay valid. Check: the secret exists and has exactly the keys in
   `APP_CONFIG_SECRET_KEYS` (compare key names only).
2. **Image.** Create the ECR repository `aarvasa-web`; build and push the image
   tagged with the git SHA of the release that is live on Amplify.
   Check: `docker run` the image locally against a non-production database and
   run `test/e2e/listing-moderation.e2e.mjs`.
3. **Deploy the stack** with the context values (account, VPC, two public subnets
   in different AZs, database security group, CloudFront prefix list, image tag).
   Check: ECS service steady with 2 healthy targets; the database security group
   now has the task-SG rule *in addition to* the existing ones.
4. **Private connectivity proof.** From the new CloudFront domain:
   `/robots.txt` 200, `/api/properties` 200 with the live catalogue,
   `/projects/reef-998-dlrc` 200. In CloudWatch Logs, no Prisma connection
   errors. Check the database's connection list shows sessions from the VPC's
   private addresses.
5. **Auth on the new domain.** Add the new CloudFront domain to the Google OAuth
   client's redirect URIs temporarily; sign in, sign out, and confirm `/admin`
   for an admin and 403 for a user. Remove the temporary redirect URI after
   step 6.
6. **Switch traffic.** Point `www.aarvasa.com` (and the apex redirect) at the new
   distribution with its ACM certificate; set `AUTH_URL` in the app-config
   secret to the production origin; redeploy the service. Keep Amplify running.
   Check: live smoke (pages, APIs, 3D model hash, the session-cache replay test
   from earlier releases), for at least 24 hours.
7. **Close the public path** — only after step 6 has held:
   - remove the `0.0.0.0/0` ingress rule on 5432;
   - set the instance to `PubliclyAccessible=false` (applies in a maintenance
     window or immediately; brief endpoint DNS change);
   - re-run the step 6 checks.
   Done means: `describe-db-instances` reports `PubliclyAccessible: false` and the
   security group has no CIDR rule on 5432.
8. **Decommission Amplify** after a quiet week, keeping the rollback below
   possible until then.

## Rollback

- Before step 6: delete or scale the stack to zero; nothing user-facing changed.
- After step 6, before step 7: point DNS back at Amplify (it never stopped
  running and still has its own `DATABASE_URL`).
- After step 7: re-add the `0.0.0.0/0` rule and set `PubliclyAccessible=true`
  **before** pointing DNS back at Amplify — Amplify cannot reach a private
  database. Rehearse this once before step 7.
