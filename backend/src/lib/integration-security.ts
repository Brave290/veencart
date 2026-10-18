import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type MerchantRequestParts = {
  method: string;
  path: string;
  timestamp: number;
  nonce: string;
  body: string;
};

export type MerchantSignature = {
  keyId: string;
  timestamp: number;
  nonce: string;
  signature: string;
};

const MAX_CLOCK_SKEW_SECONDS = 300;
const NONCE_BYTES = 18;

function bodyDigest(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export function canonicalMerchantRequest(parts: MerchantRequestParts): string {
  return [
    parts.method.trim().toUpperCase(),
    parts.path,
    String(parts.timestamp),
    parts.nonce,
    bodyDigest(parts.body),
  ].join('\n');
}

export function signMerchantRequest(parts: MerchantRequestParts, secret: string): string {
  if (!secret || secret.length < 32) {
    throw new Error('Merchant signing secrets must contain at least 32 characters.');
  }
  return createHmac('sha256', secret)
    .update(canonicalMerchantRequest(parts), 'utf8')
    .digest('hex');
}

export function createMerchantRequestSignature(
  keyId: string,
  body: string,
  options: { method: string; path: string; nowSeconds?: number; nonce?: string },
  secret: string
): MerchantSignature {
  const timestamp = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const nonce = options.nonce ?? randomBytes(NONCE_BYTES).toString('base64url');
  const signature = signMerchantRequest(
    { method: options.method, path: options.path, timestamp, nonce, body },
    secret
  );
  return { keyId, timestamp, nonce, signature };
}

function safeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function verifyMerchantRequestSignature(
  parts: MerchantRequestParts,
  suppliedSignature: string,
  secret: string,
  options: { nowSeconds?: number; maxClockSkewSeconds?: number } = {}
): boolean {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxSkew = options.maxClockSkewSeconds ?? MAX_CLOCK_SKEW_SECONDS;
  if (!Number.isSafeInteger(parts.timestamp) || Math.abs(now - parts.timestamp) > maxSkew) {
    return false;
  }
  const expected = signMerchantRequest(parts, secret);
  return safeEqualHex(expected, suppliedSignature);
}

export function validateMerchantNonce(nonce: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(nonce);
}

export function idempotencyFingerprint(method: string, path: string, body: string): string {
  return createHash('sha256')
    .update(`${method.toUpperCase()}\n${path}\n${body}`, 'utf8')
    .digest('hex');
}
