import { beforeAll, describe, expect, it } from 'vitest';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams, KeyDerivation } from '../../../src/core/crypto/keyDerivation';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('KeyDerivation', () => {
  let sodium: Sodium;

  beforeAll(async () => {
    sodium = await initSodium();
  });

  it('bate com o vetor conhecido do libsodium (crypto_pwhash, Argon2id13, opslimit mínimo)', () => {
    const password = hexToBytes(
      'b540beb016a5366524d4605156493f9874514a5aa58818cd0c6dfffaa9e90205f17b',
    );
    const salt = hexToBytes('44071f6d181561670bda728d43fb79b4');
    const expectedHex =
      '7fb72409b0987f8190c3729710e98c3f80c5a8727d425fdcde7f3644d467fe973f5b5fee' +
      '683bd3fce812cb9ae5e9921a2d06c2f1905e4e839692f2b934b682f11a2fe2b90482ea5dd' +
      '234863516dba6f52dc0702d324ec77d860c2e181f84472bd7104fedce071ffa93c530949' +
      '4ad51623d214447a7b2b1462dc7d5d55a1f6fd5b54ce024118d86f0c6489d16545aaa87b' +
      '6689dad9f2fb47fda9894f8e12b87d978b483ccd4cc5fd9595cdc7a818452f915ce2f7d' +
      'f95ec12b1c72e3788d473441d884f9748eb14703c21b45d82fd667b85f5b2d98c13303b' +
      '3fe76285531a826b6fc0fe8e3dddecf';

    const derived = sodium.crypto_pwhash(
      231,
      password,
      salt,
      1,
      1631659,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );

    expect(bytesToHex(derived)).toBe(expectedHex);
  });

  it('KeyDerivation.deriveKey é determinística para as mesmas entradas', () => {
    const kdf = new KeyDerivation(sodium);
    const salt = kdf.generateSalt();
    const params = interactiveParams(sodium);

    const key1 = kdf.deriveKey('frase-senha-fictícia', salt, params, 32);
    const key2 = kdf.deriveKey('frase-senha-fictícia', salt, params, 32);

    expect(key1).toEqual(key2);
  });

  it('KeyDerivation.deriveKey produz saída diferente para salts diferentes', () => {
    const kdf = new KeyDerivation(sodium);
    const params = interactiveParams(sodium);

    const key1 = kdf.deriveKey('frase-senha-fictícia', kdf.generateSalt(), params, 32);
    const key2 = kdf.deriveKey('frase-senha-fictícia', kdf.generateSalt(), params, 32);

    expect(key1).not.toEqual(key2);
  });

  it('KeyDerivation.generateSalt gera valores de tamanho correto e distintos', () => {
    const kdf = new KeyDerivation(sodium);
    const salt1 = kdf.generateSalt();
    const salt2 = kdf.generateSalt();

    expect(salt1.length).toBe(kdf.saltBytes);
    expect(salt1).not.toEqual(salt2);
  });
});
