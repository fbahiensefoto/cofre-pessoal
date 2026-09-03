import { describe, expect, it } from 'vitest';
import { CURRENT_VERSION, HEADER_LENGTH, VaultHeader } from '../../../src/core/vault/vaultHeader';
import { VaultCorruptHeaderError } from '../../../src/core/vault/vaultExceptions';

function sampleHeader(): VaultHeader {
  return new VaultHeader(
    CURRENT_VERSION,
    67108864,
    2,
    Uint8Array.from({ length: 16 }, (_, i) => i),
  );
}

describe('VaultHeader', () => {
  it('round-trip: fromBytes(toBytes()) preserva todos os campos', () => {
    const header = sampleHeader();
    const parsed = VaultHeader.fromBytes(header.toBytes());

    expect(parsed.formatVersion).toBe(header.formatVersion);
    expect(parsed.kdfMemLimit).toBe(header.kdfMemLimit);
    expect(parsed.kdfOpsLimit).toBe(header.kdfOpsLimit);
    expect(parsed.salt).toEqual(header.salt);
  });

  it('toBytes() produz exatamente HEADER_LENGTH bytes', () => {
    expect(sampleHeader().toBytes().length).toBe(HEADER_LENGTH);
  });

  it('dataAad contém só magic + versão (6 bytes), estável entre cabeçalhos com salts diferentes', () => {
    const header1 = sampleHeader();
    const header2 = new VaultHeader(
      CURRENT_VERSION,
      999999,
      9,
      Uint8Array.from({ length: 16 }, (_, i) => 255 - i),
    );

    expect(header1.dataAad.length).toBe(6);
    expect(header1.dataAad).toEqual(header2.dataAad);
  });

  it('fromBytes rejeita magic inválido', () => {
    const bytes = sampleHeader().toBytes();
    bytes[0] = 0x00;

    expect(() => VaultHeader.fromBytes(bytes)).toThrow(VaultCorruptHeaderError);
  });

  it('fromBytes rejeita bytes truncados', () => {
    const bytes = sampleHeader().toBytes();
    const truncado = bytes.slice(0, HEADER_LENGTH - 1);

    expect(() => VaultHeader.fromBytes(truncado)).toThrow(VaultCorruptHeaderError);
  });
});
