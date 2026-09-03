// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams } from '../../../src/core/crypto/keyDerivation';
import { VaultRepository } from '../../../src/core/vault/vaultRepository';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';
import { SettingsScreen } from '../../../src/ui/screens/SettingsScreen';

describe('SettingsScreen', () => {
  let sodium: Sodium;
  let repository: VaultRepository;

  beforeAll(async () => {
    sodium = await initSodium();
  });

  beforeEach(async () => {
    localStorage.clear();
    repository = new VaultRepository(sodium, new VaultStorage());
    await repository.createVault('senha-antiga-ficticia', interactiveParams(sodium));
  });

  afterEach(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('troca a senha mestra com sucesso', async () => {
    render(<SettingsScreen repository={repository} onBack={() => {}} onLock={() => {}} />);

    fireEvent.input(screen.getByLabelText(/senha atual/i), { target: { value: 'senha-antiga-ficticia' } });
    fireEvent.input(screen.getByLabelText(/nova senha/i), { target: { value: 'senha-nova-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /trocar senha/i }));

    await waitFor(() => expect(screen.getByText(/senha alterada/i)).toBeTruthy());
    await expect(repository.openSession('senha-nova-ficticia')).resolves.toBeTruthy();
  });

  it('mostra erro quando a senha atual está errada', async () => {
    render(<SettingsScreen repository={repository} onBack={() => {}} onLock={() => {}} />);

    fireEvent.input(screen.getByLabelText(/senha atual/i), { target: { value: 'senha-errada' } });
    fireEvent.input(screen.getByLabelText(/nova senha/i), { target: { value: 'senha-nova-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /trocar senha/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('alterna o tema', () => {
    render(<SettingsScreen repository={repository} onBack={() => {}} onLock={() => {}} />);

    fireEvent.click(screen.getByLabelText(/tema escuro/i));
    expect(document.documentElement.dataset.theme).toBe('dark');

    fireEvent.click(screen.getByLabelText(/tema claro/i));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
