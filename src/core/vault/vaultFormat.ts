import { VaultCorruptHeaderError } from './vaultExceptions';
import { HEADER_LENGTH, VaultHeader } from './vaultHeader';
import type { WrappedDek } from './vaultKeyManager';

const WRAP_NONCE_LENGTH = 24; // crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
const WRAP_CIPHERTEXT_LENGTH = 48; // DEK (32B) + tag Poly1305 (16B)
const DATA_NONCE_LENGTH = 24;
const DATA_LENGTH_FIELD_SIZE = 4;

export class VaultFile {
  constructor(
    public readonly header: VaultHeader,
    public readonly wrappedDek: WrappedDek,
    public readonly dataNonce: Uint8Array,
    public readonly dataCiphertext: Uint8Array,
  ) {}

  toBytes(): Uint8Array {
    const headerBytes = this.header.toBytes();
    const dataLengthBytes = new Uint8Array(DATA_LENGTH_FIELD_SIZE);
    new DataView(dataLengthBytes.buffer).setUint32(0, this.dataCiphertext.length, false);

    const result = new Uint8Array(
      headerBytes.length +
        WRAP_NONCE_LENGTH +
        WRAP_CIPHERTEXT_LENGTH +
        DATA_NONCE_LENGTH +
        DATA_LENGTH_FIELD_SIZE +
        this.dataCiphertext.length,
    );

    let offset = 0;
    result.set(headerBytes, offset);
    offset += headerBytes.length;
    result.set(this.wrappedDek.nonce, offset);
    offset += WRAP_NONCE_LENGTH;
    result.set(this.wrappedDek.ciphertext, offset);
    offset += WRAP_CIPHERTEXT_LENGTH;
    result.set(this.dataNonce, offset);
    offset += DATA_NONCE_LENGTH;
    result.set(dataLengthBytes, offset);
    offset += DATA_LENGTH_FIELD_SIZE;
    result.set(this.dataCiphertext, offset);

    return result;
  }

  static fromBytes(bytes: Uint8Array): VaultFile {
    let offset = HEADER_LENGTH;
    if (bytes.length < offset) {
      throw new VaultCorruptHeaderError('Cabeçalho truncado.');
    }
    const header = VaultHeader.fromBytes(bytes.slice(0, offset));

    if (bytes.length < offset + WRAP_NONCE_LENGTH + WRAP_CIPHERTEXT_LENGTH) {
      throw new VaultCorruptHeaderError('Seção de chave embrulhada truncada.');
    }
    const wrapNonce = bytes.slice(offset, offset + WRAP_NONCE_LENGTH);
    offset += WRAP_NONCE_LENGTH;
    const wrapCiphertext = bytes.slice(offset, offset + WRAP_CIPHERTEXT_LENGTH);
    offset += WRAP_CIPHERTEXT_LENGTH;

    if (bytes.length < offset + DATA_NONCE_LENGTH + DATA_LENGTH_FIELD_SIZE) {
      throw new VaultCorruptHeaderError('Seção de dados truncada.');
    }
    const dataNonce = bytes.slice(offset, offset + DATA_NONCE_LENGTH);
    offset += DATA_NONCE_LENGTH;
    const dataLengthView = new DataView(bytes.buffer, bytes.byteOffset + offset, DATA_LENGTH_FIELD_SIZE);
    const dataLength = dataLengthView.getUint32(0, false);
    offset += DATA_LENGTH_FIELD_SIZE;

    if (bytes.length < offset + dataLength) {
      throw new VaultCorruptHeaderError('Ciphertext de dados truncado.');
    }
    const dataCiphertext = bytes.slice(offset, offset + dataLength);

    return new VaultFile(header, { nonce: wrapNonce, ciphertext: wrapCiphertext }, dataNonce, dataCiphertext);
  }
}
