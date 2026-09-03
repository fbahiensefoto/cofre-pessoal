// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Credential } from '../../../src/core/model/credential';
import type { VaultSessionContextValue } from '../../../src/ui/state/VaultSessionContext';
import * as VaultSessionContext from '../../../src/ui/state/VaultSessionContext';
import { CredentialFormScreen } from '../../../src/ui/screens/CredentialFormScreen';

function sampleCredential(): Credential {
  return {
    id: 'id-form',
    serviceName: 'Serviço Form',
    category: 'site',
    password: 'senha-form-ficticia',
    tags: [],
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function mockSession(overrides: Partial<VaultSessionContextValue> = {}): VaultSessionContextValue {
  return {
    credentials: [sampleCredential()],
    addCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    toggleFavorite: vi.fn(),
    lock: vi.fn(),
    ...overrides,
  };
}

describe('CredentialFormScreen', () => {
  it('modo criação: chama addCredential e onDone ao salvar', async () => {
    const addCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addCredential }));
    const onDone = vi.fn();

    render(<CredentialFormScreen onDone={onDone} onCancel={() => {}} />);

    fireEvent.input(screen.getByLabelText(/nome do serviço/i), { target: { value: 'Novo Serviço' } });
    fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'Trabalho' } });
    fireEvent.input(screen.getByLabelText(/^senha/i), { target: { value: 'nova-senha-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(addCredential).toHaveBeenCalled());
    expect(addCredential.mock.calls[0]![0]).toMatchObject({ serviceName: 'Novo Serviço', category: 'Trabalho', password: 'nova-senha-ficticia' });
    expect(onDone).toHaveBeenCalled();
  });

  it('modo edição: preenche os campos e chama updateCredential ao salvar', async () => {
    const updateCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ updateCredential }));
    const onDone = vi.fn();

    render(<CredentialFormScreen credentialId="id-form" onDone={onDone} onCancel={() => {}} />);

    expect((screen.getByLabelText(/nome do serviço/i) as HTMLInputElement).value).toBe('Serviço Form');
    // "site" não está na lista fixa de categorias — precisa continuar selecionável e
    // preservado, para não corromper silenciosamente uma credencial já existente.
    expect((screen.getByLabelText(/categoria/i) as HTMLSelectElement).value).toBe('site');

    fireEvent.input(screen.getByLabelText(/nome do serviço/i), { target: { value: 'Serviço Form Editado' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(updateCredential).toHaveBeenCalledWith(
        'id-form',
        expect.objectContaining({ serviceName: 'Serviço Form Editado', category: 'site' }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('modo edição: exclusão pede confirmação antes de chamar deleteCredential', async () => {
    const deleteCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ deleteCredential }));
    const onDone = vi.fn();

    render(<CredentialFormScreen credentialId="id-form" onDone={onDone} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /excluir/i }));
    expect(deleteCredential).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => expect(deleteCredential).toHaveBeenCalledWith('id-form'));
    expect(onDone).toHaveBeenCalled();
  });

  it('cancelar a exclusão não chama deleteCredential', () => {
    const deleteCredential = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ deleteCredential }));

    render(<CredentialFormScreen credentialId="id-form" onDone={() => {}} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /excluir/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(deleteCredential).not.toHaveBeenCalled();
  });
});
