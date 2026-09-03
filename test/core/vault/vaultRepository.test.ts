import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams, type Argon2Params } from '../../../src/core/crypto/keyDerivation';
import type { Credential } from '../../../src/core/model/credential';
import {
  VaultAuthenticationFailedError,
  VaultNotFoundError,
  VaultUnsupportedVersionError,
} from '../../../src/core/vault/vaultExceptions';
import { VaultRepository } from '../../../src/core/vault/vaultRepository';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';

describe('VaultRepository', () => {
  let sodium: Sodium;
  let params: Argon2Params;
  let repo: VaultRepository;

  beforeAll(async () => {
    sodium = await initSodium();
    params = interactiveParams(sodium);
  });

  beforeEach(() => {
    repo = new VaultRepository(sodium, new VaultStorage());
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('createVault seguido de openVault com a senha correta devolve lista vazia', async () => {
    await repo.createVault('frase-senha-ficticia', params);

    const credenciais = await repo.openVault('frase-senha-ficticia');

    expect(credenciais).toEqual([]);
  });

  it('openVault sem cofre existente lança VaultNotFoundError', async () => {
    await expect(repo.openVault('qualquer-coisa')).rejects.toThrow(VaultNotFoundError);
  });

  it('openVault com senha errada lança VaultAuthenticationFailedError', async () => {
    await repo.createVault('senha-correta-ficticia', params);

    await expect(repo.openVault('senha-errada-ficticia')).rejects.toThrow(VaultAuthenticationFailedError);
  });

  it('adulterar um byte do arquivo gravado faz openVault falhar com a senha correta', async () => {
    await repo.createVault('senha-correta-ficticia', params);

    const storage = new VaultStorage();
    const bytes = await storage.readBytes();
    const adulterado = new Uint8Array(bytes);
    adulterado[adulterado.length - 1]! ^= 0xff; // último byte fica dentro do ciphertext de dados
    await storage.writeAtomic(adulterado);

    await expect(repo.openVault('senha-correta-ficticia')).rejects.toThrow(VaultAuthenticationFailedError);
  });

  it('versão de formato desconhecida lança VaultUnsupportedVersionError', async () => {
    await repo.createVault('senha-correta-ficticia', params);

    const storage = new VaultStorage();
    const bytes = await storage.readBytes();
    const adulterado = new Uint8Array(bytes);
    // Bytes 4-5 = formatVersion (uint16 big-endian). Define uma versão futura inexistente.
    adulterado[4] = 0x00;
    adulterado[5] = 0x63; // 99
    await storage.writeAtomic(adulterado);

    await expect(repo.openVault('senha-correta-ficticia')).rejects.toThrow(VaultUnsupportedVersionError);
  });

  it('changeMasterPassword: senha antiga passa a falhar, nova funciona, dados preservados', async () => {
    const senhaCredencial = 'senha-da-credencial-rotacao-ficticia-4r8p';
    const nomeServico = 'Serviço Fictício De Rotação ABC';
    const credencial: Credential = {
      id: 'id-ficticio-004',
      serviceName: nomeServico,
      category: 'e-mail',
      username: 'usuario.rotacao.ficticio@exemplo.invalido',
      password: senhaCredencial,
      tags: [],
      favorite: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await repo.createVault('senha-antiga-ficticia', params, [credencial]);

    await repo.changeMasterPassword('senha-antiga-ficticia', 'senha-nova-ficticia', params);

    await expect(repo.openVault('senha-antiga-ficticia')).rejects.toThrow(VaultAuthenticationFailedError);

    const credenciais = await repo.openVault('senha-nova-ficticia');
    expect(credenciais).toHaveLength(1);
    expect(credenciais[0]?.serviceName).toBe(nomeServico);
    expect(credenciais[0]?.password).toBe(senhaCredencial);
  });

  it('o registro no IndexedDB não contém a senha mestra nem dados de credenciais em texto puro', async () => {
    const senha = 'frase-senha-super-secreta-de-teste-9x7z';
    const senhaCredencial = 'senha-da-credencial-ficticia-8k2m';
    const nomeServico = 'Serviço Fictício De Teste XYZ';
    const credencial: Credential = {
      id: 'id-ficticio-003',
      serviceName: nomeServico,
      category: 'e-mail',
      username: 'usuario.ficticio.teste@exemplo.invalido',
      password: senhaCredencial,
      tags: [],
      favorite: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await repo.createVault(senha, params, [credencial]);

    const storage = new VaultStorage();
    const bytes = await storage.readBytes();
    const conteudo = Array.from(bytes)
      .filter((b) => b >= 32 && b < 127)
      .map((b) => String.fromCharCode(b))
      .join('');

    expect(conteudo.includes(senha)).toBe(false);
    expect(conteudo.includes(senhaCredencial)).toBe(false);
    expect(conteudo.includes(nomeServico)).toBe(false);
    expect(conteudo.includes('usuario.ficticio.teste')).toBe(false);

    const credenciaisAbertas = await repo.openVault(senha);
    expect(credenciaisAbertas).toHaveLength(1);
    expect(credenciaisAbertas[0]?.serviceName).toBe(nomeServico);
    expect(credenciaisAbertas[0]?.password).toBe(senhaCredencial);
  });
});
