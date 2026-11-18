import * as Crypto from 'expo-crypto';

/**
 * Identificador novo (UUID v4) gerado no próprio aparelho. Como não depende do
 * servidor, registros podem ser criados offline sem risco de colisão.
 */
export function newId() {
  return Crypto.randomUUID();
}
