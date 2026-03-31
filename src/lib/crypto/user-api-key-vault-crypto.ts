import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getMasterKeyBuffer(): Buffer {
  const raw = process.env.USER_API_KEY_VAULT_KEY?.trim();
  if (!raw) {
    throw new Error("USER_API_KEY_VAULT_KEY is not configured");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "USER_API_KEY_VAULT_KEY must decode to 32 bytes (use openssl rand -base64 32)",
    );
  }
  return buf;
}

export function isUserApiKeyVaultConfigured(): boolean {
  try {
    getMasterKeyBuffer();
    return true;
  } catch {
    return false;
  }
}

/** Returns base64(iv || ciphertext || authTag). */
export function sealUserApiKeySecret(plaintext: string): string {
  const key = getMasterKeyBuffer();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

export function unsealUserApiKeySecret(sealedBase64: string): string {
  const key = getMasterKeyBuffer();
  const buf = Buffer.from(sealedBase64, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("invalid sealed payload");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
