# Creating and recovering administrator accounts

`prisma/seed.js` is for **local development only**. It refuses to run when
`NODE_ENV=production` or when `DATABASE_URL` is not a local database, and it
has no default password: set `SEED_PASSWORD` (16+ characters) yourself. It
never prints a credential.

## Production administrators

Production admins are never created by the seed. The controlled process:

1. The person signs up normally (or signs in with Google) on the live site.
2. An existing administrator promotes that user to `ADMIN` in the Admin panel
   (Users tab).
3. The new administrator changes any temporary password under
   Dashboard → Profile.

## Recovering an administrator whose password was reset

A reset administrator's one-time password is stored in AWS Secrets Manager
(us-east-1) under `aarvasa/prod/admin-recovery/<first six characters of the
user id>`. An authorised operator retrieves it with:

    aws secretsmanager get-secret-value --region us-east-1 \
      --secret-id aarvasa/prod/admin-recovery/<id-prefix> \
      --query SecretString --output text

passes it to the account owner over a separate channel, and the owner changes
it immediately under Dashboard → Profile. Delete the secret afterwards.

## Exposed passwords

`src/lib/compromised-passwords.ts` lists SHA-256 fingerprints of passwords
known to be public. They are refused at sign-in, mobile login, sign-up,
mobile registration and password change. Add a fingerprint — never the value —
whenever a credential is found exposed. Removing a password from the current
code does **not** remove it from the repository's public Git history.
