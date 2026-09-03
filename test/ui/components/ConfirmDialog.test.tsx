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
});
