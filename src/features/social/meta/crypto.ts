import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia das chaves de acesso da Meta (AES-256-GCM).
 * A chave mestra fica só no servidor, na variável SOCIAL_TOKEN_KEY (32 bytes em base64).
 */
function masterKey(raw = process.env.SOCIAL_TOKEN_KEY): Buffer {
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("SOCIAL_TOKEN_KEY ausente ou inválida (precisa de 32 bytes em base64).");
  return key;
}

export function encryptToken(token: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(rawKey), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptToken(sealed: string, rawKey?: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Chave de acesso em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
