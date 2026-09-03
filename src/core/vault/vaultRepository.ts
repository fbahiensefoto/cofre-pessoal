import type { Sodium } from '../crypto/sodiumProvider';
import { AeadCipher } from '../crypto/aeadCipher';
import type { Argon2Params } from '../crypto/keyDerivation';
import type { Credential } from '../model/credential';
import type { Person } from '../model/person';
import { VaultAuthenticationFailedError, VaultNotFoundError, VaultUnsupportedVersionError } from './vaultExceptions';
import { VaultFile } from './vaultFormat';
import { CURRENT_VERSION, VaultHeader } from './vaultHeader';
import { VaultKeyManager, type WrappedDek } from './vaultKeyManager';
import { VaultStorage } from './vaultStorage';

export interface VaultSession {
  dek: Uint8Array;
  closed: boolean;
}

/** Formato do payload cifrado: pessoas e credenciais viajam juntas no mesmo blob. */
export interface VaultData {
  people: Person[];
  credentials: Credential[];
}

export class VaultRepository {
  private readonly keyManager: VaultKeyManager;
  private readonly aead: AeadCipher;

  constructor(
    private readonly sodium: Sodium,
    private readonly storage: VaultStorage,
  ) {
    this.keyManager = new VaultKeyManager(sodium);
    this.aead = new AeadCipher(sodium);
  }

  get sodiumInstance(): Sodium {
    return this.sodium;
  }

  /**
   * [initialCredentials] existe só para permitir testar nesta fase que
   * credenciais não aparecem em texto puro no IndexedDB. CRUD completo
   * (adicionar após a criação, editar, listar) é Fase 2.
   */
  async createVault(masterPassword: string, params: Argon2Params, initialCredentials: Credential[] = []): Promise<void> {
    const dek = this.keyManager.generateDek();
    try {
      const { header, wrapped } = this.keyManager.wrapNewDek(dek, masterPassword, params);
      const file = this.encryptPayload(header, wrapped, dek, { people: [], credentials: initialCredentials });
      await this.storage.writeAtomic(file.toBytes());
    } finally {
      this.sodium.memzero(dek);
    }
  }

  async openVault(masterPassword: string): Promise<Credential[]> {
    if (!(await this.storage.exists())) {
      throw new VaultNotFoundError();
    }

    const bytes = await this.storage.readBytes();
    const file = VaultFile.fromBytes(bytes);

    if (file.header.formatVersion !== CURRENT_VERSION) {
      throw new VaultUnsupportedVersionError(file.header.formatVersion);
    }

    const dek = this.keyManager.unwrapDek(file.header, file.wrappedDek, masterPassword);
    try {
      return this.decryptPayload(file.header, file, dek).credentials;
    } finally {
      this.sodium.memzero(dek);
    }
  }

  async changeMasterPassword(currentPassword: string, newPassword: string, params: Argon2Params): Promise<void> {
    if (!(await this.storage.exists())) {
      throw new VaultNotFoundError();
    }

    const bytes = await this.storage.readBytes();
    const file = VaultFile.fromBytes(bytes);

    if (file.header.formatVersion !== CURRENT_VERSION) {
      throw new VaultUnsupportedVersionError(file.header.formatVersion);
    }

    const dek = this.keyManager.unwrapDek(file.header, file.wrappedDek, currentPassword);
    try {
      const { header, wrapped } = this.keyManager.rewrapDek(dek, newPassword, params);
      const newFile = new VaultFile(header, wrapped, file.dataNonce, file.dataCiphertext);
      await this.storage.writeAtomic(newFile.toBytes());
    } finally {
      this.sodium.memzero(dek);
    }
  }

  async openSession(masterPassword: string): Promise<{ session: VaultSession; people: Person[]; credentials: Credential[] }> {
    if (!(await this.storage.exists())) {
      throw new VaultNotFoundError();
    }

    const bytes = await this.storage.readBytes();
    const file = VaultFile.fromBytes(bytes);

    if (file.header.formatVersion !== CURRENT_VERSION) {
      throw new VaultUnsupportedVersionError(file.header.formatVersion);
    }

    const dek = this.keyManager.unwrapDek(file.header, file.wrappedDek, masterPassword);
    const { people, credentials } = this.decryptPayload(file.header, file, dek);

    return { session: { dek, closed: false }, people, credentials };
  }

  async saveVaultData(session: VaultSession, data: VaultData): Promise<void> {
    if (session.closed) {
      throw new Error('Sessão já foi bloqueada.');
    }

    const bytes = await this.storage.readBytes();
    const file = VaultFile.fromBytes(bytes);

    // Usa file.header (lido agora do storage): wrapNewDek/rewrapDek geram um
    // header novo (salt novo) a cada chamada e autenticam wrappedDek contra os
    // bytes desse header novo. Se changeMasterPassword rodou depois que esta
    // sessão foi aberta, file.header e file.wrappedDek já formam o par
    // consistente e atual — persistir um header desatualizado junto com
    // file.wrappedDek (novo) deixaria essa dupla inconsistente e o cofre
    // permanentemente inabrível, mesmo com a senha nova correta. session.dek
    // continua válido para reuso: changeMasterPassword reembrulha a mesma DEK,
    // nunca gera uma nova.
    const newFile = this.encryptPayload(file.header, file.wrappedDek, session.dek, data);
    await this.storage.writeAtomic(newFile.toBytes());
  }

  closeSession(session: VaultSession): void {
    this.sodium.memzero(session.dek);
    session.closed = true;
  }

  private encryptPayload(header: VaultHeader, wrapped: WrappedDek, dek: Uint8Array, data: VaultData): VaultFile {
    const payload = new TextEncoder().encode(JSON.stringify(data));
    const nonce = this.aead.generateNonce();
    const ciphertext = this.aead.encrypt(payload, nonce, dek, header.dataAad);
    return new VaultFile(header, wrapped, nonce, ciphertext);
  }

  private decryptPayload(header: VaultHeader, file: VaultFile, dek: Uint8Array): VaultData {
    try {
      const plain = this.aead.decrypt(file.dataCiphertext, file.dataNonce, dek, header.dataAad);
      return JSON.parse(new TextDecoder().decode(plain)) as VaultData;
    } catch {
      throw new VaultAuthenticationFailedError();
    }
  }
}
