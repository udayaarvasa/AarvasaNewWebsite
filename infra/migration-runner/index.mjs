/**
 * One-time database migration runner.
 *
 * Exists because the media database is private, and it must stay that way: it
 * has no public address and its security group admits one security group on
 * 5432 and nothing else. Reaching it means running inside the VPC, so this runs
 * as a Lambda attached to the isolated subnets, does its work, and is deleted.
 *
 * It is not part of the application. The worker never migrates on its own, and
 * nothing here is wired into startup — a process that silently alters a schema
 * when it happens to boot is how production schemas get changed by accident.
 *
 * The password is read from Secrets Manager at runtime and never logged, never
 * returned, and never written to an environment variable or a stack output.
 */
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const CLI = "/var/task/node_modules/prisma/build/index.js";
const SCHEMA = "/var/task/prisma/schema.prisma";

/** Never let a connection string reach a log line. */
const mask = (text) =>
  String(text ?? "").replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://***:***@");

async function prisma(args, env) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args], {
      env: {
        ...process.env,
        ...env,
        // The task directory is read-only; Prisma needs somewhere to write.
        HOME: "/tmp",
        npm_config_cache: "/tmp/.npm",
        PRISMA_HIDE_UPDATE_MESSAGE: "1",
        CHECKPOINT_DISABLE: "1",
      },
      maxBuffer: 16 * 1024 * 1024,
    });
    return { ok: true, out: mask(stdout) + mask(stderr) };
  } catch (err) {
    return { ok: false, out: mask(err.stdout) + mask(err.stderr) + mask(err.message) };
  }
}

export async function handler(event) {
  const steps = [];
  /* `{ "mode": "status" }` reads and reports, and writes nothing: the plan can
     be inspected before anything is applied. Any other invocation migrates. */
  const statusOnly = event?.mode === "status";
  const note = (step, ok, detail) => steps.push({ step, ok, detail: mask(detail).slice(0, 900) });

  // ── 1. Credential ──────────────────────────────────────────────────────
  const arn = process.env.MEDIA_DATABASE_SECRET_ARN;
  if (!arn) return { ok: false, error: "MEDIA_DATABASE_SECRET_ARN is not set" };

  const sm = new SecretsManagerClient({});
  let databaseUrl;
  try {
    const res = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
    const parsed = JSON.parse(res.SecretString ?? "{}");
    databaseUrl = parsed.DATABASE_URL;
    if (typeof databaseUrl !== "string") throw new Error("secret has no DATABASE_URL string");
    note("read secret", true, "retrieved");
  } catch (err) {
    note("read secret", false, err.message);
    return { ok: false, steps };
  }

  if (statusOnly) {
    // migrate status exits non-zero when migrations are pending; the output is the answer either way.
    const status = await prisma(["migrate", "status", "--schema", SCHEMA], { DATABASE_URL: databaseUrl });
    note("migrate status (read-only)", true, status.out);
    return { ok: true, mode: "status", steps };
  }

  // ── 2. Create the database if it is missing ────────────────────────────
  // PostgreSQL has no CREATE DATABASE IF NOT EXISTS, and it cannot run inside a
  // transaction, so the duplicate-database error is the idempotency check.
  const target = new URL(databaseUrl);
  const dbName = target.pathname.replace(/^\//, "") || "aarvasa_media";
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";

  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/create.sql", `CREATE DATABASE "${dbName}";`);
  const created = await prisma(["db", "execute", "--url", adminUrl.toString(), "--file", "/tmp/create.sql"]);
  if (created.ok) {
    note("create database", true, `created ${dbName}`);
  } else if (/already exists/i.test(created.out)) {
    note("create database", true, `${dbName} already existed`);
  } else {
    note("create database", false, created.out);
    return { ok: false, steps };
  }

  // ── 3. Apply migrations ────────────────────────────────────────────────
  // deploy only: it applies pending migrations and never resets or drops.
  const deploy = await prisma(["migrate", "deploy", "--schema", SCHEMA], { DATABASE_URL: databaseUrl });
  note("migrate deploy", deploy.ok, deploy.out);
  if (!deploy.ok) return { ok: false, steps };

  // ── 4. Verify ──────────────────────────────────────────────────────────
  const status = await prisma(["migrate", "status", "--schema", SCHEMA], { DATABASE_URL: databaseUrl });
  note("migrate status", status.ok, status.out);

  /* Assert the tables are really there rather than inferring it from the
     migration log. `db execute` returns no rows, so the check raises instead:
     success means every table below exists. */
  writeFileSync(
    "/tmp/verify.sql",
    `DO $$
     DECLARE missing text;
     BEGIN
       FOREACH missing IN ARRAY ARRAY['MediaAsset','Entitlement','Payment','User','Property','_prisma_migrations'] LOOP
         IF to_regclass(format('public.%I', missing)) IS NULL THEN
           RAISE EXCEPTION 'missing table: %', missing;
         END IF;
       END LOOP;
     END $$;`,
  );
  const verify = await prisma(["db", "execute", "--url", databaseUrl, "--file", "/tmp/verify.sql"]);
  note("verify tables", verify.ok, verify.ok ? "MediaAsset, Entitlement, Payment, User, Property and _prisma_migrations all present" : verify.out);
  if (!verify.ok) return { ok: false, steps };

  return { ok: true, database: dbName, steps };
}
