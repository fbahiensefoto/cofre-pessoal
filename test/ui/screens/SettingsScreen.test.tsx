// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams } from '../../../src/core/crypto/keyDerivation';
import { VaultRepository } from '../../../src/core/vault/vaultRepository';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';
import type { VaultSessionContextValue } from '../../../src/ui/state/VaultSessionContext';
import * as VaultSessionContext from '../../../src/ui/state/VaultSessionContext';
import { SettingsScreen } from '../../../src/ui/screens/SettingsScreen';

function mockVaultSession(overrides: Partial<VaultSessionContextValue> = {}): VaultSessionContextValue {
  return {
    people: [],
    credentials: [],
    addPerson: vi.fn(),
    addCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    toggleFavorite: vi.fn(),
    lock: vi.fn(),
    ...overrides,
  };
}

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
    // SettingsScreen agora consome useVaultSession() diretamente (Fix 2 da revisão
    // final): precisa estar "dentro" de um provider. Como estes testes focam na
    // troca de senha mestra (que fala com o repository via prop, não via contexto),
    // mockar useVaultSession é mais simples do que abrir uma sessão real por teste.
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockVaultSession());
  });

  afterEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('troca a senha mestra com sucesso', async () => {
    render(<SettingsScreen repository={repository} onBack={() => {}} />);

    fireEvent.input(screen.getByLabelText(/senha atual/i), { target: { value: 'senha-antiga-ficticia' } });
    fireEvent.input(screen.getByLabelText(/^nova senha$/i), { target: { value: 'senha-nova-ficticia' } });
    fireEvent.input(screen.getByLabelText(/confirme a nova senha/i), { target: { value: 'senha-nova-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /trocar senha/i }));

    await waitFor(() => expect(screen.getByText(/senha alterada/i)).toBeTruthy());
    await expect(repository.openSession('senha-nova-ficticia')).resolves.toBeTruthy();
  });

  it('mostra erro quando a senha atual está errada', async () => {
    render(<SettingsScreen repository={repository} onBack={() => {}} />);

    fireEvent.input(screen.getByLabelText(/senha atual/i), { target: { value: 'senha-errada' } });
    fireEvent.input(screen.getByLabelText(/^nova senha$/i), { target: { value: 'senha-nova-ficticia' } });
    fireEvent.input(screen.getByLabelText(/confirme a nova senha/i), { target: { value: 'senha-nova-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /trocar senha/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('nova senha e confirmação diferentes: mostra erro e não chama changeMasterPassword', async () => {
    const changeMasterPasswordSpy = vi.spyOn(repository, 'changeMasterPassword');
    render(<SettingsScreen repository={repository} onBack={() => {}} />);

    fireEvent.input(screen.getByLabelText(/senha atual/i), { target: { value: 'senha-antiga-ficticia' } });
    fireEvent.input(screen.getByLabelText(/^nova senha$/i), { target: { value: 'senha-nova-ficticia' } });
    fireEvent.input(screen.getByLabelText(/confirme a nova senha/i), { target: { value: 'senha-nova-diferente' } });
    fireEvent.click(screen.getByRole('button', { name: /trocar senha/i }));

    await waitFor(() => expect(screen.getByText(/não coincidem/i)).toBeTruthy());
    expect(changeMasterPasswordSpy).not.toHaveBeenCalled();
    // A senha antiga continua sendo a válida — a troca não foi de fato aplicada.
    await expect(repository.openSession('senha-antiga-ficticia')).resolves.toBeTruthy();
  });

  it('nova senha vazia: mostra erro e não chama changeMasterPassword', async () => {
    const changeMasterPasswordSpy = vi.spyOn(repository, 'changeMasterPassword');
    render(<SettingsScreen repository={repository} onBack={() => {}} />);

    fireEvent.input(screen.getByLabelText(/senha atual/i), { target: { value: 'senha-antiga-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /trocar senha/i }));

    await waitFor(() => expect(screen.getByText(/digite a nova senha/i)).toBeTruthy());
    expect(changeMasterPasswordSpy).not.toHaveBeenCalled();
    await expect(repository.openSession('senha-antiga-ficticia')).resolves.toBeTruthy();
  });

  it('alterna o tema', () => {
    render(<SettingsScreen repository={repository} onBack={() => {}} />);

    fireEvent.click(screen.getByLabelText(/tema escuro/i));
    expect(document.documentElement.dataset.theme).toBe('dark');

    fireEvent.click(screen.getByLabelText(/tema claro/i));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('"Bloquear cofre" chama lock() do VaultSessionContext (não uma cópia local)', () => {
    const lock = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockVaultSession({ lock }));
    render(<SettingsScreen repository={repository} onBack={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /bloquear cofre/i }));

    expect(lock).toHaveBeenCalledTimes(1);
  });
});
