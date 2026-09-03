import type { Sodium } from '../crypto/sodiumProvider';
import { AeadCipher } from '../crypto/aeadCipher';
import { KeyDerivation, type Argon2Params } from '../crypto/keyDerivation';
import { VaultAuthenticationFailedError } from './vaultExceptions';
import { CURRENT_VERSION, VaultHeader } from './vaultHeader';

export interface WrappedDek {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface WrapResult {
  header: VaultHeader;
  wrapped: WrappedDek;
}

export class VaultKeyManager {
  private readonly keyDerivation: KeyDerivation;
  private readonly aead: AeadCipher;

  constructor(private readonly sodium: Sodium) {
    this.keyDerivation = new KeyDerivation(sodium);
    this.aead = new AeadCipher(sodium);
  }

  generateDek(): Uint8Array {
    return this.sodium.randombytes_buf(this.aead.keyBytes);
  }

  wrapNewDek(dek: Uint8Array, masterPassword: string, params: Argon2Params): WrapResult {
    const salt = this.keyDerivation.generateSalt();
    const header = new VaultHeader(CURRENT_VERSION, params.memLimit, params.opsLimit, salt);
    const kek = this.keyDerivation.deriveKey(masterPassword, salt, params, this.aead.keyBytes);
    try {
      const nonce = this.aead.generateNonce();
      const ciphertext = this.aead.encrypt(dek, nonce, kek, header.toBytes());
      return { header, wrapped: { nonce, ciphertext } };
    } finally {
      this.sodium.memzero(kek);
    }
  }

  unwrapDek(header: VaultHeader, wrapped: WrappedDek, masterPassword: string): Uint8Array {
    const params: Argon2Params = { opsLimit: header.kdfOpsLimit, memLimit: header.kdfMemLimit };
    let kek: Uint8Array | undefined;
    try {
      kek = this.keyDerivation.deriveKey(masterPassword, header.salt, params, this.aead.keyBytes);
      return this.aead.decrypt(wrapped.ciphertext, wrapped.nonce, kek, header.toBytes());
    } catch {
      throw new VaultAuthenticationFailedError();
    } finally {
      if (kek !== undefined) {
        this.sodium.memzero(kek);
      }
    }
  }

  rewrapDek(dek: Uint8Array, newMasterPassword: string, params: Argon2Params): WrapResult {
    return this.wrapNewDek(dek, newMasterPassword, params);
  }
}
