import { createHash, randomBytes } from "node:crypto";

export interface GeneratedKey {
  /** Shown to the user exactly once, never stored. */
  secret: string;
  /** Non-secret identifier displayed in the dashboard, e.g. "kubo_live_Ab3dE9". */
  prefix: string;
  /** SHA-256 hex — the only form persisted and the form the gateway looks up. */
  hash: string;
}

/** 256 bits of entropy: `kubo_<env>_<43 base64url chars>`. Must match gateway/app/keys.py. */
export function generateApiKey(env: "live" | "test"): GeneratedKey {
  const secret = `kubo_${env}_${randomBytes(32).toString("base64url")}`;
  return {
    secret,
    prefix: secret.slice(0, 16),
    hash: createHash("sha256").update(secret, "utf8").digest("hex"),
  };
}
