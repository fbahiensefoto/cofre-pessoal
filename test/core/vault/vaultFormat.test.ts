import { describe, expect, it } from 'vitest';
import { VaultFile } from '../../../src/core/vault/vaultFormat';
import { CURRENT_VERSION, HEADER_LENGTH, VaultHeader } from '../../../src/core/vault/vaultHeader';
import { VaultCorruptHeaderError } from '../../../src/core/vault/vaultExceptions';

function sampleFile(): VaultFile {
  return new VaultFile(
    new VaultHeader(CURRENT_VERSION, 67108864, 2, Uint8Array.from({ length: 16 }, (_, i) => i)),
    {
      nonce: Uint8Array.from({ length: 24 }, (_, i) => i),
      ciphertext: Uint8Array.from({ length: 48 }, (_, i) => 255 - i),
    },
    Uint8Array.from({ length: 24 }, (_, i) => 24 - i),
    Uint8Array.from({ length: 100 }, (_, i) => i % 256),
  );
}

describe('VaultFile', () => {
  it('round-trip: fromBytes(toBytes()) preserva todas as seções', () => {
    const file = sampleFile();
    const parsed = VaultFile.fromBytes(file.toBytes());

    expect(parsed.header.formatVersion).toBe(file.header.formatVersion);
    expect(parsed.header.kdfMemLimit).toBe(file.header.kdfMemLimit);
    expect(parsed.header.kdfOpsLimit).toBe(file.header.kdfOpsLimit);
    expect(parsed.header.salt).toEqual(file.header.salt);
    expect(parsed.wrappedDek.nonce).toEqual(file.wrappedDek.nonce);
    expect(parsed.wrappedDek.ciphertext).toEqual(file.wrappedDek.ciphertext);
    expect(parsed.dataNonce).toEqual(file.dataNonce);
    expect(parsed.dataCiphertext).toEqual(file.dataCiphertext);
  });

  it('funciona com dataCiphertext vazio (cofre recém-criado, sem credenciais)', () => {
    const base = sampleFile();
    const file = new VaultFile(base.header, base.wrappedDek, base.dataNonce, new Uint8Array(0));
    const parsed = VaultFile.fromBytes(file.toBytes());

    expect(parsed.dataCiphertext.length).toBe(0);
  });

  it('fromBytes rejeita arquivo truncado na seção de chave', () => {
    const bytes = sampleFile().toBytes();
    const truncado = bytes.slice(0, HEADER_LENGTH + 10);

    expect(() => VaultFile.fromBytes(truncado)).toThrow(VaultCorruptHeaderError);
  });

  it('fromBytes rejeita arquivo truncado na seção de dados', () => {
    const bytes = sampleFile().toBytes();
    const truncado = bytes.slice(0, bytes.length - 10);

    expect(() => VaultFile.fromBytes(truncado)).toThrow(VaultCorruptHeaderError);
  });
});
