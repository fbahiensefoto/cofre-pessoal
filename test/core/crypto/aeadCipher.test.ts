import { beforeAll, describe, expect, it } from 'vitest';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { AeadCipher } from '../../../src/core/crypto/aeadCipher';

describe('AeadCipher', () => {
  let sodium: Sodium;
  let aead: AeadCipher;

  beforeAll(async () => {
    sodium = await initSodium();
    aead = new AeadCipher(sodium);
  });

  it('round-trip: decifrar o que foi cifrado devolve a mensagem original', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');

    const cipherText = aead.encrypt(message, nonce, key);
    const plainText = aead.decrypt(cipherText, nonce, key);

    expect(plainText).toEqual(message);
  });

  it('round-trip com dados associados (AAD) confere e detecta troca de AAD', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');
    const aad = new TextEncoder().encode('cabecalho-v1');
    const aadTrocado = new TextEncoder().encode('cabecalho-v2');

    const cipherText = aead.encrypt(message, nonce, key, aad);
    const plainText = aead.decrypt(cipherText, nonce, key, aad);
    expect(plainText).toEqual(message);

    expect(() => aead.decrypt(cipherText, nonce, key, aadTrocado)).toThrow();
  });

  it('adulterar um byte do ciphertext faz a decifração falhar', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');

    const cipherText = aead.encrypt(message, nonce, key);
    const adulterado = new Uint8Array(cipherText);
    adulterado[0] ^= 0xff;

    expect(() => aead.decrypt(adulterado, nonce, key)).toThrow();
  });

  it('decifrar com o nonce errado falha', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const outroNonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');

    const cipherText = aead.encrypt(message, nonce, key);

    expect(() => aead.decrypt(cipherText, outroNonce, key)).toThrow();
  });

  it('decifrar com a chave errada falha', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const outraKey = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');

    const cipherText = aead.encrypt(message, nonce, key);

    expect(() => aead.decrypt(cipherText, nonce, outraKey)).toThrow();
  });

  it('unicidade estatística dos nonces gerados', () => {
    const nonces = Array.from({ length: 1000 }, () => aead.generateNonce());
    const unicos = new Set(nonces.map((n) => Buffer.from(n).toString('base64')));
    expect(unicos.size).toBe(nonces.length);
  });
});
