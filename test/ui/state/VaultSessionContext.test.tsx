// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams, type Argon2Params } from '../../../src/core/crypto/keyDerivation';
import { VaultRepository } from '../../../src/core/vault/vaultRepository';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';
import { VaultSessionProvider, useVaultSession } from '../../../src/ui/state/VaultSessionContext';

function TestConsumer() {
  const { credentials, addCredential, deleteCredential, toggleFavorite, lock } = useVaultSession();
  return (
    <div>
      <span data-testid="count">{credentials.length}</span>
      <button
        onClick={() =>
          addCredential({
            serviceName: 'Serviço Teste',
            category: 'site',
            password: 'senha-ficticia-teste',
            tags: [],
            favorite: false,
          })
        }
      >
        adicionar
      </button>
      {credentials.map((c) => (
        <div key={c.id}>
          <span>{c.serviceName}</span>
          <span data-testid={`fav-${c.id}`}>{String(c.favorite)}</span>
          <button onClick={() => toggleFavorite(c.id)}>favoritar {c.id}</button>
          <button onClick={() => deleteCredential(c.id)}>excluir {c.id}</button>
        </div>
      ))}
      <button onClick={lock}>bloquear</button>
    </div>
  );
}

describe('VaultSessionContext', () => {
  let sodium: Sodium;
  let params: Argon2Params;
  let repository: VaultRepository;

  beforeAll(async () => {
    sodium = await initSodium();
    params = interactiveParams(sodium);
  });

  beforeEach(() => {
    repository = new VaultRepository(sodium, new VaultStorage());
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('adiciona, favorita e exclui uma credencial, persistindo a cada ação', async () => {
    await repository.createVault('senha-ficticia', params);
    const { session, credentials } = await repository.openSession('senha-ficticia');
    let bloqueado = false;

    render(
      <VaultSessionProvider repository={repository} session={session} initialCredentials={credentials} onLock={() => (bloqueado = true)}>
        <TestConsumer />
      </VaultSessionProvider>,
    );

    expect(screen.getByTestId('count').textContent).toBe('0');

    fireEvent.click(screen.getByText('adicionar'));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByText('Serviço Teste')).toBeTruthy();

    // Confirma persistência real: abre uma sessão nova e vê a credencial.
    const { session: sessao2, credentials: credenciais2 } = await repository.openSession('senha-ficticia');
    expect(credenciais2).toHaveLength(1);
    repository.closeSession(sessao2);

    const id = credenciais2[0]!.id;
    fireEvent.click(screen.getByText(`favoritar ${id}`));
    await waitFor(() => expect(screen.getByTestId(`fav-${id}`).textContent).toBe('true'));

    fireEvent.click(screen.getByText(`excluir ${id}`));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    fireEvent.click(screen.getByText('bloquear'));
    expect(bloqueado).toBe(true);
  });
});
