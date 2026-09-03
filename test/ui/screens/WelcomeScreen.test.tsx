// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { VaultRepository } from '../../../src/core/vault/vaultRepository';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';
import { WelcomeScreen } from '../../../src/ui/screens/WelcomeScreen';

describe('WelcomeScreen', () => {
  let sodium: Sodium;
  let repository: VaultRepository;

  beforeAll(async () => {
    sodium = await initSodium();
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

  it('cria o cofre quando as duas senhas coincidem e chama onCreated', async () => {
    let resultado: unknown = null;
    render(<WelcomeScreen repository={repository} sodium={sodium} onCreated={(r) => (resultado = r)} />);

    fireEvent.input(screen.getByLabelText(/crie uma senha mestra/i), {
      target: { value: 'frase-senha-ficticia-de-teste-longa' },
    });
    fireEvent.input(screen.getByLabelText(/confirme a senha mestra/i), {
      target: { value: 'frase-senha-ficticia-de-teste-longa' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar cofre/i }));

    await waitFor(() => expect(resultado).not.toBeNull());
    expect(await repository.openSession('frase-senha-ficticia-de-teste-longa')).toBeTruthy();
  });

  it('mostra erro quando as senhas não coincidem, e não cria o cofre', async () => {
    render(<WelcomeScreen repository={repository} sodium={sodium} onCreated={() => {}} />);

    fireEvent.input(screen.getByLabelText(/crie uma senha mestra/i), { target: { value: 'senha-um-ficticia' } });
    fireEvent.input(screen.getByLabelText(/confirme a senha mestra/i), { target: { value: 'senha-diferente-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /criar cofre/i }));

    await waitFor(() => expect(screen.getByText(/as senhas não coincidem/i)).toBeTruthy());
    expect(await repository.openSession('senha-um-ficticia').catch((e) => e)).toBeInstanceOf(Error);
  });

  it('mostra o medidor de força ao digitar', () => {
    render(<WelcomeScreen repository={repository} sodium={sodium} onCreated={() => {}} />);
    fireEvent.input(screen.getByLabelText(/crie uma senha mestra/i), { target: { value: 'abc' } });
    expect(screen.getByText(/força:/i)).toBeTruthy();
  });
});
