// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Person } from '../../../src/core/model/person';
import type { VaultSessionContextValue } from '../../../src/ui/state/VaultSessionContext';
import * as VaultSessionContext from '../../../src/ui/state/VaultSessionContext';
import { NewPersonScreen } from '../../../src/ui/screens/NewPersonScreen';

function samplePeople(): Person[] {
  return [{ id: 'id-pessoa-cintia', name: 'Cíntia de Souza', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }];
}

function mockSession(overrides: Partial<VaultSessionContextValue> = {}): VaultSessionContextValue {
  return {
    people: samplePeople(),
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

describe('NewPersonScreen', () => {
  it('cadastra a pessoa e chama onCreated com o nome, ao salvar', async () => {
    const addPerson = vi.fn().mockImplementation(async (name: string) => ({
      id: 'id-nova-pessoa',
      name,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addPerson }));
    const onCreated = vi.fn();

    render(<NewPersonScreen onCreated={onCreated} onCancel={() => {}} />);

    fireEvent.input(screen.getByLabelText(/nome/i), { target: { value: 'Juninho Informática' } });
    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    await waitFor(() => expect(addPerson).toHaveBeenCalledWith('Juninho Informática'));
    expect(onCreated).toHaveBeenCalledWith('Juninho Informática');
  });

  it('não deixa cadastrar com o nome em branco', async () => {
    const addPerson = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addPerson }));

    render(<NewPersonScreen onCreated={() => {}} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/digite o nome/i);
    expect(addPerson).not.toHaveBeenCalled();
  });

  it('recusa um nome que já está cadastrado, sem chamar addPerson', async () => {
    const addPerson = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addPerson }));

    render(<NewPersonScreen onCreated={() => {}} onCancel={() => {}} />);

    fireEvent.input(screen.getByLabelText(/nome/i), { target: { value: 'Cíntia de Souza' } });
    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/já está cadastrada/i);
    expect(addPerson).not.toHaveBeenCalled();
  });

  it('chama onCancel ao clicar em voltar', () => {
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession());
    const onCancel = vi.fn();

    render(<NewPersonScreen onCreated={() => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
