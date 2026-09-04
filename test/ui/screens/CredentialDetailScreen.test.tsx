// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Credential } from '../../../src/core/model/credential';
import type { VaultSessionContextValue } from '../../../src/ui/state/VaultSessionContext';
import * as VaultSessionContext from '../../../src/ui/state/VaultSessionContext';
import * as Clipboard from '../../../src/ui/lib/clipboard';
import { CredentialDetailScreen } from '../../../src/ui/screens/CredentialDetailScreen';

function sampleCredential(): Credential {
  return {
    id: 'id-detalhe',
    owner: 'Fábio Bahiense',
    serviceName: 'Serviço Detalhe',
    category: 'site',
    username: 'usuario.ficticio',
    password: 'senha-secreta-ficticia',
    notes: 'observação fictícia',
    tags: ['trabalho'],
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function mockSession(credentials: Credential[]): VaultSessionContextValue {
  return {
    people: [],
    credentials,
    addPerson: vi.fn(),
    addCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    toggleFavorite: vi.fn(),
    lock: vi.fn(),
  };
}

describe('CredentialDetailScreen', () => {
  it('mostra os dados da credencial com a senha oculta por padrão', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession([sampleCredential()]));
    render(<CredentialDetailScreen credentialId="id-detalhe" onBack={() => {}} onEdit={() => {}} />);

    expect(screen.getByText('Serviço Detalhe')).toBeTruthy();
    expect(screen.getByText('Fábio Bahiense')).toBeTruthy();
    expect(screen.getByText('usuario.ficticio')).toBeTruthy();
    expect(screen.queryByText('senha-secreta-ficticia')).toBeNull();
  });

  it('sem senha cadastrada (login via Google, GitHub etc.), não mostra a seção de senha, mas mostra o método de login', () => {
    const credencial = { ...sampleCredential(), password: '', loginProvider: 'Google' };
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession([credencial]));
    render(<CredentialDetailScreen credentialId="id-detalhe" onBack={() => {}} onEdit={() => {}} />);

    expect(screen.queryByRole('button', { name: /revelar senha/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /copiar senha/i })).toBeNull();
    expect(screen.getByText('Google')).toBeTruthy();
  });

  it('revela e oculta a senha ao clicar no botão', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession([sampleCredential()]));
    render(<CredentialDetailScreen credentialId="id-detalhe" onBack={() => {}} onEdit={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /revelar senha/i }));
    expect(screen.getByText('senha-secreta-ficticia')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ocultar senha/i }));
    expect(screen.queryByText('senha-secreta-ficticia')).toBeNull();
  });

  describe('copiar usuário e senha', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('copia o usuário e mostra confirmação temporária', async () => {
      const copySpy = vi.spyOn(Clipboard, 'copyToClipboard').mockResolvedValue(true);
      vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession([sampleCredential()]));
      render(<CredentialDetailScreen credentialId="id-detalhe" onBack={() => {}} onEdit={() => {}} />);

      fireEvent.click(screen.getByRole('button', { name: /copiar usuário/i }));

      expect(copySpy).toHaveBeenCalledWith('usuario.ficticio');
      await waitFor(() => expect(screen.getByRole('button', { name: /^copiado!$/i })).toBeTruthy());
    });

    it('copia o site e mostra confirmação temporária', async () => {
      const copySpy = vi.spyOn(Clipboard, 'copyToClipboard').mockResolvedValue(true);
      const credencial = { ...sampleCredential(), url: 'https://banco.exemplo.com' };
      vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession([credencial]));
      render(<CredentialDetailScreen credentialId="id-detalhe" onBack={() => {}} onEdit={() => {}} />);

      fireEvent.click(screen.getByRole('button', { name: /copiar site/i }));

      expect(copySpy).toHaveBeenCalledWith('https://banco.exemplo.com');
      await waitFor(() => expect(screen.getByRole('button', { name: /^copiado!$/i })).toBeTruthy());
    });

    it('copia a senha de verdade, mesmo oculta na tela, e mostra confirmação temporária', async () => {
      const copySpy = vi.spyOn(Clipboard, 'copyToClipboard').mockResolvedValue(true);
      vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession([sampleCredential()]));
      render(<CredentialDetailScreen credentialId="id-detalhe" onBack={() => {}} onEdit={() => {}} />);

      // Sem revelar a senha primeiro — copiar não depende de estar visível.
      expect(screen.queryByText('senha-secreta-ficticia')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /copiar senha/i }));

      expect(copySpy).toHaveBeenCalledWith('senha-secreta-ficticia');
      await waitFor(() => expect(screen.getAllByRole('button', { name: /^copiado!$/i })).toHaveLength(1));
    });

    it('não mostra confirmação quando a cópia falha', async () => {
      vi.spyOn(Clipboard, 'copyToClipboard').mockResolvedValue(false);
      vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession([sampleCredential()]));
      render(<CredentialDetailScreen credentialId="id-detalhe" onBack={() => {}} onEdit={() => {}} />);

      fireEvent.click(screen.getByRole('button', { name: /copiar senha/i }));

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByRole('button', { name: /^copiado!$/i })).toBeNull();
    });
  });

  it('chama onEdit ao clicar em editar', () => {
    const onEdit = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession([sampleCredential()]));
    render(<CredentialDetailScreen credentialId="id-detalhe" onBack={() => {}} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(onEdit).toHaveBeenCalledWith('id-detalhe');
  });
});
