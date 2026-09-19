import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/**
 * The application database URL, read once per cold start from Secrets Manager
 * (never from the environment, never logged). The secret holds either the URL
 * itself or JSON with a DATABASE_URL field. The Lambda role may read only this
 * one secret ARN.
 */
export interface SecretReader {
  readSecretString(secretArn: string): Promise<string>;
}

export function secretsManagerReader(region: string): SecretReader {
  const client = new SecretsManagerClient({ region });
  return {
    async readSecretString(secretArn) {
      const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
      if (!result.SecretString) throw new Error("Database secret has no string value");
      return result.SecretString;
    },
  };
}

export function parseDatabaseUrl(secret: string): string {
  let url = secret.trim();
  if (url.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(url);
    } catch {
      throw new Error("Database secret is not valid JSON");
    }
    const value = (parsed as { DATABASE_URL?: unknown }).DATABASE_URL;
    if (typeof value !== "string") throw new Error("Database secret JSON has no DATABASE_URL string");
    url = value.trim();
  }
  if (!/^postgres(ql)?:\/\/[^\s]+$/.test(url)) throw new Error("Database secret does not hold a PostgreSQL URL");
  return url;
}

let cached: Promise<string> | null = null;

/** Memoised per container; a failed read is retried on the next invocation. */
export function getDatabaseUrl(reader: SecretReader, secretArn: string): Promise<string> {
  if (!cached) {
    cached = reader.readSecretString(secretArn).then(parseDatabaseUrl);
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
