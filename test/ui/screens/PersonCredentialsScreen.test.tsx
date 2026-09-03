// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import type { Credential } from '../../../src/core/model/credential';
import type { VaultSessionContextValue } from '../../../src/ui/state/VaultSessionContext';
import * as VaultSessionContext from '../../../src/ui/state/VaultSessionContext';
import { PersonCredentialsScreen } from '../../../src/ui/screens/PersonCredentialsScreen';

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
    people: [],
    credentials: sampleCredentials(),
    addPerson: vi.fn(),
    addCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    toggleFavorite: vi.fn(),
    lock: vi.fn(),
    ...overrides,
  };
}

describe('PersonCredentialsScreen', () => {
  it('lista só as credenciais da pessoa informada, não as de outra pessoa', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(
      <PersonCredentialsScreen owner="Fábio Bahiense" onBack={() => {}} onSelectCredential={() => {}} onCreateNew={() => {}} />,
    );

    expect(screen.getByText('Banco Fictício')).toBeTruthy();
    expect(screen.queryByText('E-mail Fictício')).toBeNull();
  });

  it('mostra o nome da pessoa como título', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(
      <PersonCredentialsScreen owner="Cíntia de Souza" onBack={() => {}} onSelectCredential={() => {}} onCreateNew={() => {}} />,
    );

    expect(screen.getByRole('heading', { name: 'Cíntia de Souza' })).toBeTruthy();
  });

  it('filtra pela busca, dentro do escopo da pessoa', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(
      <PersonCredentialsScreen owner="Fábio Bahiense" onBack={() => {}} onSelectCredential={() => {}} onCreateNew={() => {}} />,
    );

    fireEvent.input(screen.getByLabelText(/pesquisar/i), { target: { value: 'banco' } });
    expect(screen.getByText('Banco Fictício')).toBeTruthy();

    fireEvent.input(screen.getByLabelText(/pesquisar/i), { target: { value: 'nada-encontra-isso' } });
    expect(screen.queryByText('Banco Fictício')).toBeNull();
  });

  it('chama onSelectCredential ao clicar num item', () => {
    const onSelectCredential = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(
      <PersonCredentialsScreen owner="Fábio Bahiense" onBack={() => {}} onSelectCredential={onSelectCredential} onCreateNew={() => {}} />,
    );

    fireEvent.click(screen.getByText('Banco Fictício'));
    expect(onSelectCredential).toHaveBeenCalledWith('id-1');
  });

  it('chama onCreateNew ao clicar em adicionar', () => {
    const onCreateNew = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(
      <PersonCredentialsScreen owner="Fábio Bahiense" onBack={() => {}} onSelectCredential={() => {}} onCreateNew={onCreateNew} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /adicionar credencial/i }));
    expect(onCreateNew).toHaveBeenCalled();
  });

  it('chama onBack ao clicar em voltar', () => {
    const onBack = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<PersonCredentialsScreen owner="Fábio Bahiense" onBack={onBack} onSelectCredential={() => {}} onCreateNew={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('não repete o nome da pessoa em cada linha (só aparece uma vez, no título)', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(
      <PersonCredentialsScreen owner="Fábio Bahiense" onBack={() => {}} onSelectCredential={() => {}} onCreateNew={() => {}} />,
    );

    expect(screen.getAllByText('Fábio Bahiense')).toHaveLength(1);
  });
});
