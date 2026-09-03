import type { Sodium } from './sodiumProvider';

export interface Argon2Params {
  opsLimit: number;
  memLimit: number;
}

/**
 * Preset conservador (64 MiB / 2 iterações) usado como baseline provisório
 * nesta fase. Precisa ser revalidado com benchmark no Safari do iPhone real
 * antes de qualquer uso além de testes — ver docs/fase1-entrega.md.
 */
export function interactiveParams(sodium: Sodium): Argon2Params {
  return {
    opsLimit: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memLimit: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  };
}

export class KeyDerivation {
  constructor(private readonly sodium: Sodium) {}

  get saltBytes(): number {
    return this.sodium.crypto_pwhash_SALTBYTES;
  }

  generateSalt(): Uint8Array {
    return this.sodium.randombytes_buf(this.saltBytes);
  }

  deriveKey(password: string, salt: Uint8Array, params: Argon2Params, outLen: number): Uint8Array {
    return this.sodium.crypto_pwhash(
      outLen,
      password,
      salt,
      params.opsLimit,
      params.memLimit,
      this.sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
  }
}
