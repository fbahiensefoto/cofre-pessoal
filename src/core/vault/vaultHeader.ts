import { VaultCorruptHeaderError } from './vaultExceptions';

const MAGIC = new Uint8Array([0x43, 0x50, 0x56, 0x31]); // "CPV1"
export const CURRENT_VERSION = 1;
export const HEADER_LENGTH = 4 + 2 + 4 + 4 + 16; // 30 bytes

export class VaultHeader {
  constructor(
    public readonly formatVersion: number,
    public readonly kdfMemLimit: number,
    public readonly kdfOpsLimit: number,
    public readonly salt: Uint8Array,
  ) {}

  /** Bytes completos do cabeçalho — usados como AAD ao embrulhar a DEK. */
  toBytes(): Uint8Array {
    const result = new Uint8Array(HEADER_LENGTH);
    const view = new DataView(result.buffer);
    result.set(MAGIC, 0);
    view.setUint16(4, this.formatVersion, false);
    view.setUint32(6, this.kdfMemLimit, false);
    view.setUint32(10, this.kdfOpsLimit, false);
    result.set(this.salt, 14);
    return result;
  }

  /**
   * AAD usado para a seção de dados — deliberadamente não inclui salt/params,
   * para que trocar a senha mestra não exija recriptografar os dados.
   */
  get dataAad(): Uint8Array {
    const result = new Uint8Array(6);
    result.set(MAGIC, 0);
    new DataView(result.buffer).setUint16(4, this.formatVersion, false);
    return result;
  }

  static fromBytes(bytes: Uint8Array): VaultHeader {
    if (bytes.length < HEADER_LENGTH) {
      throw new VaultCorruptHeaderError('Cabeçalho truncado.');
    }
    for (let i = 0; i < MAGIC.length; i++) {
      if (bytes[i] !== MAGIC[i]) {
        throw new VaultCorruptHeaderError('Assinatura do arquivo inválida.');
      }
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_LENGTH);
    const formatVersion = view.getUint16(4, false);
    const kdfMemLimit = view.getUint32(6, false);
    const kdfOpsLimit = view.getUint32(10, false);
    const salt = bytes.slice(14, 30);

    return new VaultHeader(formatVersion, kdfMemLimit, kdfOpsLimit, salt);
  }
}
