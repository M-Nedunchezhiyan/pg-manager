import argon2 from 'argon2';

/**
 * Argon2id with OWASP-recommended parameters (2024).
 * - memoryCost: 19456 KiB (~19 MB)
 * - timeCost: 2 iterations
 * - parallelism: 1
 *
 * Verify also re-hashes if params drift, so we can ratchet up over time.
 */
const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON_OPTS);
}
