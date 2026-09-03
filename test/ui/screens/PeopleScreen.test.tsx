// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Credential } from '../../../src/core/model/credential';
import type { Person } from '../../../src/core/model/person';
import type { VaultSessionContextValue } from '../../../src/ui/state/VaultSessionContext';
import * as VaultSessionContext from '../../../src/ui/state/VaultSessionContext';
import { PeopleScreen } from '../../../src/ui/screens/PeopleScreen';

function samplePeople(): Person[] {
  return [
    { id: 'id-pessoa-fabio', name: 'Fábio Bahiense', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'id-pessoa-cintia', name: 'Cíntia de Souza', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    // Cadastrada sem nenhuma credencial ainda — precisa continuar aparecendo na lista.
    { id: 'id-pessoa-juninho', name: 'Juninho Informática', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ];
}

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
  ];
}

function mockSession(overrides: Partial<VaultSessionContextValue> = {}): VaultSessionContextValue {
  return {
    people: samplePeople(),
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

describe('PeopleScreen', () => {
  it('lista todas as pessoas cadastradas, mesmo as sem nenhuma credencial ainda', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<PeopleScreen onSelectPerson={() => {}} onOpenSettings={() => {}} />);

    expect(screen.getByText('Fábio Bahiense')).toBeTruthy();
    expect(screen.getByText('Cíntia de Souza')).toBeTruthy();
    expect(screen.getByText('Juninho Informática')).toBeTruthy();
  });

  it('mostra a contagem de credenciais de cada pessoa', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<PeopleScreen onSelectPerson={() => {}} onOpenSettings={() => {}} />);

    expect(screen.getByText('1 credencial')).toBeTruthy();
    expect(screen.getAllByText('0 credenciais')).toHaveLength(2);
  });

  it('filtra pela busca', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<PeopleScreen onSelectPerson={() => {}} onOpenSettings={() => {}} />);

    fireEvent.input(screen.getByLabelText(/pesquisar pessoa/i), { target: { value: 'Cíntia' } });

    expect(screen.getByText('Cíntia de Souza')).toBeTruthy();
    expect(screen.queryByText('Fábio Bahiense')).toBeNull();
  });

  it('chama onSelectPerson com o nome ao clicar numa pessoa', () => {
    const onSelectPerson = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<PeopleScreen onSelectPerson={onSelectPerson} onOpenSettings={() => {}} />);

    fireEvent.click(screen.getByText('Cíntia de Souza'));
    expect(onSelectPerson).toHaveBeenCalledWith('Cíntia de Souza');
  });

  it('chama onOpenSettings ao clicar em configurações', () => {
    const onOpenSettings = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    render(<PeopleScreen onSelectPerson={() => {}} onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByLabelText(/configurações/i));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('mostra mensagem de lista vazia quando não há nenhuma pessoa cadastrada', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ people: [], credentials: [] }));
    render(<PeopleScreen onSelectPerson={() => {}} onOpenSettings={() => {}} />);

    expect(screen.getByText(/nenhuma pessoa encontrada/i)).toBeTruthy();
  });

  it('cadastra a pessoa direto nesta tela, sem navegar pra outra página', async () => {
    const addPerson = vi.fn().mockImplementation(async (name: string) => ({
      id: 'id-nova-pessoa',
      name,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addPerson }));
    const onSelectPerson = vi.fn();

    render(<PeopleScreen onSelectPerson={onSelectPerson} onOpenSettings={() => {}} />);

    fireEvent.input(screen.getByLabelText(/nova pessoa/i), { target: { value: 'Maria Fictícia' } });
    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    await waitFor(() => expect(addPerson).toHaveBeenCalledWith('Maria Fictícia'));
    // Ficar na tela é a confirmação — pular pra página (vazia) da pessoa recém-criada
    // parecia, pra quem estava usando, que cadastrar não tinha feito nada.
    expect(onSelectPerson).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/nova pessoa/i) as HTMLInputElement).value).toBe('');
  });

  it('não deixa cadastrar com o nome em branco', async () => {
    const addPerson = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addPerson }));

    render(<PeopleScreen onSelectPerson={() => {}} onOpenSettings={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/digite o nome/i);
    expect(addPerson).not.toHaveBeenCalled();
  });

  it('recusa um nome que já está cadastrado, sem chamar addPerson', async () => {
    const addPerson = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addPerson }));

    render(<PeopleScreen onSelectPerson={() => {}} onOpenSettings={() => {}} />);

    fireEvent.input(screen.getByLabelText(/nova pessoa/i), { target: { value: 'Cíntia de Souza' } });
    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/já está cadastrada/i);
    expect(addPerson).not.toHaveBeenCalled();
  });
});
