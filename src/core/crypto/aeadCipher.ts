import type { Sodium } from './sodiumProvider';

export class AeadCipher {
  constructor(private readonly sodium: Sodium) {}

  get keyBytes(): number {
    return this.sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES;
  }

  get nonceBytes(): number {
    return this.sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  }

  generateNonce(): Uint8Array {
    return this.sodium.randombytes_buf(this.nonceBytes);
  }

  encrypt(message: Uint8Array, nonce: Uint8Array, key: Uint8Array, additionalData?: Uint8Array): Uint8Array {
    return this.sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      message,
      additionalData ?? null,
      null,
      nonce,
      key,
    );
  }

  decrypt(cipherText: Uint8Array, nonce: Uint8Array, key: Uint8Array, additionalData?: Uint8Array): Uint8Array {
    return this.sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      cipherText,
      additionalData ?? null,
      nonce,
      key,
    );
  }
}
