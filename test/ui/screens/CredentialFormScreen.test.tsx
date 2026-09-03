// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { Credential } from '../../../src/core/model/credential';
import type { Person } from '../../../src/core/model/person';
import type { VaultSessionContextValue } from '../../../src/ui/state/VaultSessionContext';
import * as VaultSessionContext from '../../../src/ui/state/VaultSessionContext';
import { CredentialFormScreen } from '../../../src/ui/screens/CredentialFormScreen';

function samplePeople(): Person[] {
  return [
    { id: 'id-pessoa-cintia', name: 'Cíntia de Souza', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'id-pessoa-fabio', name: 'Fábio Bahiense', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ];
}

function sampleCredential(): Credential {
  return {
    id: 'id-form',
    owner: 'Cíntia de Souza',
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
    people: samplePeople(),
    credentials: [sampleCredential()],
    addPerson: vi.fn(),
    addCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    toggleFavorite: vi.fn(),
    lock: vi.fn(),
    ...overrides,
  };
}

describe('CredentialFormScreen', () => {
  it('modo criação: a pessoa vem pré-selecionada pelo initialOwner, e é enviada ao salvar', async () => {
    const addCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addCredential }));
    const onDone = vi.fn();

    render(<CredentialFormScreen initialOwner="Fábio Bahiense" onDone={onDone} onCancel={() => {}} />);

    expect((screen.getByLabelText(/^pessoa/i) as HTMLSelectElement).value).toBe('Fábio Bahiense');

    fireEvent.input(screen.getByLabelText(/nome do serviço/i), { target: { value: 'Novo Serviço' } });
    fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'Trabalho' } });
    fireEvent.input(screen.getByLabelText(/^senha/i), { target: { value: 'nova-senha-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(addCredential).toHaveBeenCalled());
    expect(addCredential.mock.calls[0]![0]).toMatchObject({
      owner: 'Fábio Bahiense',
      serviceName: 'Novo Serviço',
      category: 'Trabalho',
      password: 'nova-senha-ficticia',
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('modo criação: dá para trocar a pessoa pré-selecionada por outra já cadastrada', async () => {
    const addCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ addCredential }));
    const onDone = vi.fn();

    render(<CredentialFormScreen initialOwner="Fábio Bahiense" onDone={onDone} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^pessoa/i), { target: { value: 'Cíntia de Souza' } });
    fireEvent.input(screen.getByLabelText(/nome do serviço/i), { target: { value: 'Novo Serviço' } });
    fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'Trabalho' } });
    fireEvent.input(screen.getByLabelText(/^senha/i), { target: { value: 'nova-senha-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(addCredential).toHaveBeenCalled());
    expect(addCredential.mock.calls[0]![0]).toMatchObject({ owner: 'Cíntia de Souza' });
  });

  it('modo edição: trocar a pessoa e salvar chama onDone com a pessoa NOVA, não a de quando o formulário abriu', async () => {
    // Reproduz o bug achado numa revisão de design: onDone devolvendo o
    // initialOwner (capturado na abertura do formulário) em vez do valor
    // realmente salvo fazia o app navegar de volta para a página da pessoa
    // ANTIGA — agora vazia — como se a credencial tivesse sumido.
    const updateCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ updateCredential }));
    const onDone = vi.fn();

    render(<CredentialFormScreen credentialId="id-form" initialOwner="Cíntia de Souza" onDone={onDone} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^pessoa/i), { target: { value: 'Fábio Bahiense' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(updateCredential).toHaveBeenCalledWith('id-form', expect.objectContaining({ owner: 'Fábio Bahiense' })),
    );
    expect(onDone).toHaveBeenCalledWith('Fábio Bahiense');
    expect(onDone).not.toHaveBeenCalledWith('Cíntia de Souza');
  });

  it('modo edição: preenche os campos (pessoa incluída) e chama updateCredential ao salvar', async () => {
    const updateCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ updateCredential }));
    const onDone = vi.fn();

    render(<CredentialFormScreen credentialId="id-form" initialOwner="Cíntia de Souza" onDone={onDone} onCancel={() => {}} />);

    expect((screen.getByLabelText(/^pessoa/i) as HTMLSelectElement).value).toBe('Cíntia de Souza');
    expect((screen.getByLabelText(/nome do serviço/i) as HTMLInputElement).value).toBe('Serviço Form');
    // "site" não está na lista fixa de categorias — precisa continuar selecionável e
    // preservado, para não corromper silenciosamente uma credencial já existente.
    expect((screen.getByLabelText(/categoria/i) as HTMLSelectElement).value).toBe('site');

    fireEvent.input(screen.getByLabelText(/nome do serviço/i), { target: { value: 'Serviço Form Editado' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(updateCredential).toHaveBeenCalledWith(
        'id-form',
        expect.objectContaining({ owner: 'Cíntia de Souza', serviceName: 'Serviço Form Editado', category: 'site' }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('modo edição: exclusão pede confirmação antes de chamar deleteCredential', async () => {
    const deleteCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ deleteCredential }));
    const onDone = vi.fn();

    render(<CredentialFormScreen credentialId="id-form" initialOwner="Cíntia de Souza" onDone={onDone} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /excluir/i }));
    expect(deleteCredential).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => expect(deleteCredential).toHaveBeenCalledWith('id-form'));
    expect(onDone).toHaveBeenCalledWith('Cíntia de Souza');
  });

  it('cancelar a exclusão não chama deleteCredential', () => {
    const deleteCredential = vi.fn();
    vi.spyOn(VaultSessionContext, 'useVaultSession').mockReturnValue(mockSession({ deleteCredential }));

    render(<CredentialFormScreen credentialId="id-form" initialOwner="Cíntia de Souza" onDone={() => {}} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /excluir/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(deleteCredential).not.toHaveBeenCalled();
  });
});
