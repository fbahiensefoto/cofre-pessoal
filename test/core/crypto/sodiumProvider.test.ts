import { describe, expect, it } from 'vitest';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';

describe('initSodium', () => {
  it('inicializa o sodium e expõe as constantes do AEAD XChaCha20-Poly1305', async () => {
    const sodium = await initSodium();

    expect(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES).toBe(32);
    expect(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES).toBe(24);
    expect(sodium.crypto_pwhash_SALTBYTES).toBe(16);
  });
});
