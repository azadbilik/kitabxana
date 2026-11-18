import { createHmac } from 'node:crypto';

/**
 * A key for one purpose, derived from JWT_SECRET, so the secret that signs staff tokens is
 * never used directly for anything else and no extra env var is needed.
 */
export function deriveKey(secret: string, purpose: 'login-code' | 'oauth-state'): Buffer {
  return createHmac('sha256', secret).update(`kitabxana/${purpose}/v1`).digest();
}
