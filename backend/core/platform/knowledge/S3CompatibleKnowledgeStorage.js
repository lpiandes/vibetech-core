/**
 * S3-compatible object storage for Knowledge blobs (prod multi-tenant).
 * Uses AWS SigV4 over fetch — no AWS SDK dependency.
 *
 * Env:
 *   KNOWLEDGE_S3_BUCKET (or OBJECT_STORAGE_BUCKET)
 *   KNOWLEDGE_S3_REGION (or AWS_REGION), default us-east-1
 *   KNOWLEDGE_S3_ACCESS_KEY_ID / KNOWLEDGE_S3_SECRET_ACCESS_KEY
 *     (or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
 *   KNOWLEDGE_S3_ENDPOINT (optional, for MinIO / R2)
 *   KNOWLEDGE_S3_FORCE_PATH_STYLE=true (optional)
 */
import crypto from "node:crypto";

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function requireConfig() {
  const bucket = env("KNOWLEDGE_S3_BUCKET") || env("OBJECT_STORAGE_BUCKET");
  const region = env("KNOWLEDGE_S3_REGION") || env("AWS_REGION") || "us-east-1";
  const accessKeyId = env("KNOWLEDGE_S3_ACCESS_KEY_ID") || env("AWS_ACCESS_KEY_ID");
  const secretAccessKey = env("KNOWLEDGE_S3_SECRET_ACCESS_KEY") || env("AWS_SECRET_ACCESS_KEY");
  const endpoint = env("KNOWLEDGE_S3_ENDPOINT") || env("OBJECT_STORAGE_ENDPOINT");
  const forcePathStyle =
    String(env("KNOWLEDGE_S3_FORCE_PATH_STYLE") || env("OBJECT_STORAGE_FORCE_PATH_STYLE") || "false").toLowerCase() ===
    "true";

  if (!bucket) throw new Error("KNOWLEDGE_S3_BUCKET is required for S3 Knowledge storage.");
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials are required for S3 Knowledge storage.");
  }

  return { bucket, region, accessKeyId, secretAccessKey, endpoint, forcePathStyle };
}

function objectKey(businessId, storageKey) {
  const bid = String(businessId).replace(/[/\\]/g, "");
  const key = String(storageKey).replace(/[/\\]/g, "");
  if (!bid || !key || key.includes("..")) throw new Error("Invalid storage key.");
  return `knowledge/${bid}/${key}`;
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, typeof data === "string" ? "utf8" : undefined).digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function amzDate(now) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function signingKey(secret, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function buildHostAndUrl({ bucket, region, endpoint, forcePathStyle, key }) {
  if (endpoint) {
    const base = endpoint.replace(/\/$/, "");
    const host = new URL(base).host;
    const url = `${base}/${bucket}/${key}`;
    return { host, url, path: `/${bucket}/${key}` };
  }
  if (forcePathStyle) {
    const host = `s3.${region}.amazonaws.com`;
    return { host, url: `https://${host}/${bucket}/${key}`, path: `/${bucket}/${key}` };
  }
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  return { host, url: `https://${host}/${key}`, path: `/${key}` };
}

async function signedRequest({ method, key, body, contentType }) {
  const cfg = requireConfig();
  const { host, url, path } = buildHostAndUrl({ ...cfg, key });
  const now = new Date();
  const { amzDate: amz, dateStamp } = amzDate(now);
  const payloadHash = sha256Hex(body ?? Buffer.alloc(0));
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };
  if (contentType) headers["content-type"] = contentType;

  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", signingKey(cfg.secretAccessKey, dateStamp, cfg.region, "s3"))
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      Authorization: authorization,
    },
    body: body && method !== "GET" && method !== "HEAD" ? body : undefined,
  });

  return { res, cfg };
}

export class S3CompatibleKnowledgeStorage {
  async putObject({ businessId, storageKey, buffer, mimeType }) {
    const key = objectKey(businessId, storageKey);
    const { res } = await signedRequest({
      method: "PUT",
      key,
      body: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer ?? []),
      contentType: mimeType || "application/octet-stream",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`S3 putObject failed (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  async getObject({ businessId, storageKey }) {
    const key = objectKey(businessId, storageKey);
    const { res } = await signedRequest({ method: "GET", key, body: null });
    if (res.status === 404) {
      const err = new Error("Knowledge object not found.");
      err.code = "NOT_FOUND";
      throw err;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`S3 getObject failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  async deleteObject({ businessId, storageKey }) {
    const key = objectKey(businessId, storageKey);
    const { res } = await signedRequest({ method: "DELETE", key, body: null });
    if (res.status === 404 || res.ok) return;
    const text = await res.text().catch(() => "");
    throw new Error(`S3 deleteObject failed (${res.status}): ${text.slice(0, 200)}`);
  }

  async objectExists({ businessId, storageKey }) {
    const key = objectKey(businessId, storageKey);
    const { res } = await signedRequest({ method: "HEAD", key, body: null });
    return res.ok;
  }
}
