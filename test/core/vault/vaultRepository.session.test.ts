import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams, type Argon2Params } from '../../../src/core/crypto/keyDerivation';
import type { Credential } from '../../../src/core/model/credential';
import { VaultAuthenticationFailedError } from '../../../src/core/vault/vaultExceptions';
import { VaultRepository } from '../../../src/core/vault/vaultRepository';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';

function sampleCredential(overrides: Partial<Credential> = {}): Credential {
  return {
    id: 'id-ficticio-sessao-001',
    serviceName: 'Serviço Fictício de Sessão',
    category: 'site',
    password: 'senha-ficticia-sessao',
    tags: [],
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('VaultRepository — sessão', () => {
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

  it('openSession devolve a sessão e as credenciais existentes', async () => {
    const credencial = sampleCredential();
    await repo.createVault('senha-ficticia', params, [credencial]);

    const { session, credentials } = await repo.openSession('senha-ficticia');

    expect(session.dek.length).toBe(32);
    expect(credentials).toHaveLength(1);
    expect(credentials[0]?.serviceName).toBe(credencial.serviceName);

    repo.closeSession(session);
  });

  it('openSession com senha errada lança VaultAuthenticationFailedError', async () => {
    await repo.createVault('senha-correta', params);

    await expect(repo.openSession('senha-errada')).rejects.toThrow(VaultAuthenticationFailedError);
  });

  it('saveCredentials persiste, e uma nova sessão vê os dados atualizados', async () => {
    await repo.createVault('senha-ficticia', params);
    const { session } = await repo.openSession('senha-ficticia');

    const novaCredencial = sampleCredential({ id: 'id-novo-002', serviceName: 'Novo Serviço' });
    await repo.saveCredentials(session, [novaCredencial]);
    repo.closeSession(session);

    const { session: sessao2, credentials } = await repo.openSession('senha-ficticia');
    expect(credentials).toHaveLength(1);
    expect(credentials[0]?.serviceName).toBe('Novo Serviço');
    repo.closeSession(sessao2);
  });

  it('saveCredentials não altera a seção de chave embrulhada (não precisa da senha de novo)', async () => {
    await repo.createVault('senha-ficticia', params);
    const { session } = await repo.openSession('senha-ficticia');

    // saveCredentials não recebe senha nenhuma — só a sessão em memória.
    await repo.saveCredentials(session, [sampleCredential()]);

    const { credentials } = await repo.openSession('senha-ficticia');
    expect(credentials).toHaveLength(1);
    repo.closeSession(session);
  });

  it('closeSession zera a DEK em memória', async () => {
    await repo.createVault('senha-ficticia', params);
    const { session } = await repo.openSession('senha-ficticia');

    const copiaAntes = session.dek.slice();
    repo.closeSession(session);

    expect(session.dek.every((b) => b === 0)).toBe(true);
    expect(copiaAntes.some((b) => b !== 0)).toBe(true);
  });

  it('closeSession marca a sessão como fechada, e saveCredentials nela passa a lançar erro', async () => {
    await repo.createVault('senha-ficticia', params);
    const { session } = await repo.openSession('senha-ficticia');

    expect(session.closed).toBe(false);
    repo.closeSession(session);
    expect(session.closed).toBe(true);

    // Sem essa checagem, isto criptografaria com uma DEK zerada e destruiria
    // o cofre bom — ver Fix 5 da revisão final da Fase 2.
    await expect(repo.saveCredentials(session, [sampleCredential()])).rejects.toThrow('Sessão já foi bloqueada.');
  });

  it('saveCredentials com sessão aberta antes de um changeMasterPassword ainda produz um cofre abrível com a nova senha', async () => {
    await repo.createVault('senha-ficticia', params);
    const { session } = await repo.openSession('senha-ficticia');

    // Troca de senha por um caminho separado (ex.: tela de configurações),
    // enquanto a sessão em memória continua aberta com o header antigo.
    await repo.changeMasterPassword('senha-ficticia', 'senha-nova-ficticia', params);

    const credencialPosTroca = sampleCredential({ id: 'id-pos-troca-003', serviceName: 'Serviço Pós-Troca' });
    await repo.saveCredentials(session, [credencialPosTroca]);
    repo.closeSession(session);

    const { session: novaSessao, credentials } = await repo.openSession('senha-nova-ficticia');
    expect(credentials).toHaveLength(1);
    expect(credentials[0]?.serviceName).toBe('Serviço Pós-Troca');
    repo.closeSession(novaSessao);
  });
});
