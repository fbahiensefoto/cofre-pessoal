// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import type { Credential } from '../../../src/core/model/credential';
import type { VaultSessionContextValue } from '../../../src/ui/state/VaultSessionContext';
import * as VaultSessionContext from '../../../src/ui/state/VaultSessionContext';
import { VaultListScreen } from '../../../src/ui/screens/VaultListScreen';

function sampleCredentials(): Credential[] {
  return [
    {
      id: 'id-1',
      owner: 'Fábio Bahiense',
      serviceName: 'Banco Fictício',
      category: 'banco',
      tags: [],
      password: 'senha-1',
      favorite: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'id-2',
      owner: 'Cíntia de Souza',
      serviceName: 'E-mail Fictício',
      category: 'e-mail',
      tags: [],
      password: 'senha-2',
      favorite: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

function mockSession(overrides: Partial<VaultSessionContextValue> = {}): VaultSessionContextValue {
  return {
    credentials: sampleCredentials(),
    addCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    toggleFavorite: vi.fn(),
    lock: vi.fn(),
    ...overrides,
  };
}

describe('VaultListScreen', () => {
  it('lista todas as credenciais', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<VaultListScreen onSelectCredential={() => {}} onCreateNew={() => {}} onOpenSettings={() => {}} />);

    expect(screen.getByText('Banco Fictício')).toBeTruthy();
    expect(screen.getByText('E-mail Fictício')).toBeTruthy();
  });

  it('filtra pela busca', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<VaultListScreen onSelectCredential={() => {}} onCreateNew={() => {}} onOpenSettings={() => {}} />);

    fireEvent.input(screen.getByLabelText(/pesquisar/i), { target: { value: 'banco' } });

    expect(screen.getByText('Banco Fictício')).toBeTruthy();
    expect(screen.queryByText('E-mail Fictício')).toBeNull();
  });

  it('chama onSelectCredential ao clicar num item', () => {
    const onSelectCredential = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<VaultListScreen onSelectCredential={onSelectCredential} onCreateNew={() => {}} onOpenSettings={() => {}} />);

    fireEvent.click(screen.getByText('Banco Fictício'));
    expect(onSelectCredential).toHaveBeenCalledWith('id-1');
  });

  it('chama onCreateNew ao clicar em adicionar', () => {
    const onCreateNew = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<VaultListScreen onSelectCredential={() => {}} onCreateNew={onCreateNew} onOpenSettings={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /adicionar credencial/i }));
    expect(onCreateNew).toHaveBeenCalled();
  });

  it('mostra um filtro por pessoa e filtra a lista ao clicar numa pessoa', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<VaultListScreen onSelectCredential={() => {}} onCreateNew={() => {}} onOpenSettings={() => {}} />);

    expect(screen.getByRole('button', { name: 'Fábio Bahiense' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cíntia de Souza' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cíntia de Souza' }));

    expect(screen.getByText('E-mail Fictício')).toBeTruthy();
    expect(screen.queryByText('Banco Fictício')).toBeNull();
  });

  it('"Todos" volta a mostrar todas as credenciais depois de filtrar por pessoa', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<VaultListScreen onSelectCredential={() => {}} onCreateNew={() => {}} onOpenSettings={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cíntia de Souza' }));
    expect(screen.queryByText('Banco Fictício')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getByText('Banco Fictício')).toBeTruthy();
    expect(screen.getByText('E-mail Fictício')).toBeTruthy();
  });

  it('a busca por texto também encontra pelo nome da pessoa', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<VaultListScreen onSelectCredential={() => {}} onCreateNew={() => {}} onOpenSettings={() => {}} />);

    fireEvent.input(screen.getByLabelText(/pesquisar/i), { target: { value: 'Cíntia' } });

    expect(screen.getByText('E-mail Fictício')).toBeTruthy();
    expect(screen.queryByText('Banco Fictício')).toBeNull();
  });
});
