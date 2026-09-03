// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { VaultRepository, type VaultSession } from '../../src/core/vault/vaultRepository';

describe('App', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('mostra a tela de boas-vindas quando não existe cofre', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /criar cofre/i })).toBeTruthy());
  });

  it('fluxo completo: criar cofre → cadastrar pessoa → adicionar credencial → aparece na lista dela → bloquear → desbloquear → continua tudo lá', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText(/crie uma senha mestra/i)).toBeTruthy());
    fireEvent.input(screen.getByLabelText(/crie uma senha mestra/i), { target: { value: 'frase-senha-app-ficticia' } });
    fireEvent.input(screen.getByLabelText(/confirme a senha mestra/i), { target: { value: 'frase-senha-app-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /criar cofre/i }));

    // Cofre vazio: cai na tela de Pessoas, sem ninguém cadastrado ainda. Cadastrar
    // uma pessoa nova é só mais um campo na própria tela, não uma tela separada.
    await waitFor(() => expect(screen.getByLabelText(/pesquisar pessoa/i)).toBeTruthy());
    expect(screen.getByText(/nenhuma pessoa encontrada/i)).toBeTruthy();

    fireEvent.input(screen.getByLabelText(/nova pessoa/i), { target: { value: 'Fábio Bahiense' } });
    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    // Cadastrar a pessoa leva direto para a página dela, ainda sem credenciais.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Fábio Bahiense' })).toBeTruthy());
    expect(screen.getByText(/nenhuma credencial encontrada/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /adicionar credencial/i }));
    await waitFor(() => expect(screen.getByLabelText(/nome do serviço/i)).toBeTruthy());

    // A pessoa já vem pré-selecionada — não precisa escolher de novo.
    expect((screen.getByLabelText(/^pessoa/i) as HTMLSelectElement).value).toBe('Fábio Bahiense');
    fireEvent.input(screen.getByLabelText(/nome do serviço/i), { target: { value: 'Serviço Fluxo Completo' } });
    fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'Trabalho' } });
    fireEvent.input(screen.getByLabelText(/^senha/i), { target: { value: 'senha-fluxo-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    // Volta para a página da pessoa e a credencial aparece lá.
    await waitFor(() => expect(screen.getByText('Serviço Fluxo Completo')).toBeTruthy());

    // Configurações só fica acessível a partir da tela de Pessoas.
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    await waitFor(() => expect(screen.getByLabelText('Configurações')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Configurações'));
    await waitFor(() => expect(screen.getByRole('button', { name: /bloquear cofre/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /bloquear cofre/i }));

    await waitFor(() => expect(screen.getByLabelText(/senha mestra/i)).toBeTruthy());
    fireEvent.input(screen.getByLabelText(/senha mestra/i), { target: { value: 'frase-senha-app-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /desbloquear/i }));

    // Desbloquear volta para a tela de Pessoas — a pessoa cadastrada continua lá.
    await waitFor(() => expect(screen.getByText('Fábio Bahiense')).toBeTruthy());
    fireEvent.click(screen.getByText('Fábio Bahiense'));
    await waitFor(() => expect(screen.getByText('Serviço Fluxo Completo')).toBeTruthy());
  });

  it('bloquear o cofre realmente zera a DEK da sessão em memória (não só navega de volta)', async () => {
    // Espiona openSession no protótipo (chamado dentro de WelcomeScreen, fora do
    // nosso controle direto) para capturar a mesma instância de VaultSession que
    // o App guarda em estado — é essa instância que precisa ter dek zerada depois
    // do clique em "Bloquear cofre", provando que o lock() do VaultSessionContext
    // (não uma navegação solta) foi de fato acionado. Ver Fix 3 da revisão final.
    const openSessionSpy = vi.spyOn(VaultRepository.prototype, 'openSession');

    render(<App />);

    await waitFor(() => expect(screen.getByLabelText(/crie uma senha mestra/i)).toBeTruthy());
    fireEvent.input(screen.getByLabelText(/crie uma senha mestra/i), { target: { value: 'frase-senha-app-dek-ficticia' } });
    fireEvent.input(screen.getByLabelText(/confirme a senha mestra/i), { target: { value: 'frase-senha-app-dek-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /criar cofre/i }));

    await waitFor(() => expect(openSessionSpy).toHaveBeenCalledTimes(1));
    const { session }: { session: VaultSession } = await openSessionSpy.mock.results[0]!.value;

    await waitFor(() => expect(screen.getByLabelText(/pesquisar pessoa/i)).toBeTruthy());
    expect(session.dek.every((b) => b === 0)).toBe(false);
    expect(session.closed).toBe(false);

    fireEvent.click(screen.getByLabelText('Configurações'));
    await waitFor(() => expect(screen.getByRole('button', { name: /bloquear cofre/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /bloquear cofre/i }));

    await waitFor(() => expect(screen.getByLabelText(/senha mestra/i)).toBeTruthy());
    expect(session.dek.every((b) => b === 0)).toBe(true);
    expect(session.closed).toBe(true);
  });
});
