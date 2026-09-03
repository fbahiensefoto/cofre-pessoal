// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ConfirmDialog } from '../../../src/ui/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('não renderiza nada quando open é falso', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Excluir" message="Tem certeza?" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(container.textContent).toBe('');
  });

  it('mostra título e mensagem quando aberto, e chama onConfirm/onCancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Excluir credencial" message="Essa ação não pode ser desfeita." onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText('Excluir credencial')).toBeTruthy();
    expect(screen.getByText('Essa ação não pode ser desfeita.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('fica fixo cobrindo a tela (não solto no fluxo normal da página)', () => {
    render(<ConfirmDialog open title="Excluir" message="Tem certeza?" onConfirm={() => {}} onCancel={() => {}} />);

    const dialog = screen.getByRole('dialog');
    // Sem position:fixed, o diálogo pode renderizar fora da área visível em
    // formulários compridos — reproduzido de verdade numa revisão de design
    // (o wrapper apareceu 100px abaixo do fim da tela ao abrir "Excluir").
    expect(dialog.style.position).toBe('fixed');
    expect(dialog.style.inset).toBe('0px');
  });
});
