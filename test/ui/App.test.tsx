// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { App } from '../../src/ui/App';

describe('App', () => {
  afterEach(async () => {
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

  it('fluxo completo: criar cofre → adicionar credencial → aparece na lista → bloquear → desbloquear → credencial continua lá', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText(/crie uma senha mestra/i)).toBeTruthy());
    fireEvent.input(screen.getByLabelText(/crie uma senha mestra/i), { target: { value: 'frase-senha-app-ficticia' } });
    fireEvent.input(screen.getByLabelText(/confirme a senha mestra/i), { target: { value: 'frase-senha-app-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /criar cofre/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /adicionar credencial/i })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /adicionar credencial/i }));
    await waitFor(() => expect(screen.getByLabelText(/nome do serviço/i)).toBeTruthy());

    fireEvent.input(screen.getByLabelText(/nome do serviço/i), { target: { value: 'Serviço Fluxo Completo' } });
    fireEvent.input(screen.getByLabelText(/categoria/i), { target: { value: 'site' } });
    fireEvent.input(screen.getByLabelText(/^senha/i), { target: { value: 'senha-fluxo-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(screen.getByText('Serviço Fluxo Completo')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Configurações'));
    await waitFor(() => expect(screen.getByRole('button', { name: /bloquear cofre/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /bloquear cofre/i }));

    await waitFor(() => expect(screen.getByLabelText(/senha mestra/i)).toBeTruthy());
    fireEvent.input(screen.getByLabelText(/senha mestra/i), { target: { value: 'frase-senha-app-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: /desbloquear/i }));

    await waitFor(() => expect(screen.getByText('Serviço Fluxo Completo')).toBeTruthy());
  });
});
