// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams } from '../../../src/core/crypto/keyDerivation';
import { VaultRepository } from '../../../src/core/vault/vaultRepository';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';
import { UnlockScreen } from '../../../src/ui/screens/UnlockScreen';

describe('UnlockScreen', () => {
  let sodium: Sodium;
  let repository: VaultRepository;

  beforeAll(async () => {
    sodium = await initSodium();
  });

  beforeEach(async () => {
    repository = new VaultRepository(sodium, new VaultStorage());
    await repository.createVault('senha-correta-ficticia', interactiveParams(sodium));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('desbloqueia com a senha correta e chama onUnlocked', async () => {
    let resultado: unknown = null;
    render(<UnlockScreen repository={repository} onUnlocked={(r) => (resultado = r)} />);

    fireEvent.input(screen.getByLabelText(/senha mestra/i), { target: { value: 'senha-correta-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /desbloquear/i }));

    await waitFor(() => expect(resultado).not.toBeNull());
  });

  it('mostra erro com a senha errada e não chama onUnlocked', async () => {
    let chamado = false;
    render(<UnlockScreen repository={repository} onUnlocked={() => (chamado = true)} />);

    fireEvent.input(screen.getByLabelText(/senha mestra/i), { target: { value: 'senha-errada-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /desbloquear/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(chamado).toBe(false);
  });
});
