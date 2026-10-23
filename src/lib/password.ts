import * as Crypto from 'expo-crypto';

/**
 * A senha nunca é gravada em texto puro: guardamos SHA-256(salt + senha),
 * com um salt aleatório por usuário.
 */
export async function hashPassword(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

export function generateSalt() {
  return Crypto.randomUUID();
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const hash = await hashPassword(password, salt);
  return hash === expectedHash;
}
