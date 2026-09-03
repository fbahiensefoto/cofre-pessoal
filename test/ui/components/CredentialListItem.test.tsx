// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import type { Credential } from '../../../src/core/model/credential';
import { CredentialListItem } from '../../../src/ui/components/CredentialListItem';

function sampleCredential(overrides: Partial<Credential> = {}): Credential {
  return {
    id: 'id-item-teste',
    serviceName: 'Serviço Item Teste',
    category: 'e-mail',
    tags: ['pessoal', 'importante'],
    password: 'senha-ficticia',
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CredentialListItem', () => {
  it('mostra nome do serviço, categoria e tags', () => {
    render(<CredentialListItem credential={sampleCredential()} onSelect={() => {}} onToggleFavorite={() => {}} />);
    expect(screen.getByText('Serviço Item Teste')).toBeTruthy();
    expect(screen.getByText('e-mail')).toBeTruthy();
    expect(screen.getByText('pessoal')).toBeTruthy();
    expect(screen.getByText('importante')).toBeTruthy();
  });

  it('chama onSelect ao clicar no item', () => {
    const onSelect = vi.fn();
    render(<CredentialListItem credential={sampleCredential()} onSelect={onSelect} onToggleFavorite={() => {}} />);
    fireEvent.click(screen.getByText('Serviço Item Teste'));
    expect(onSelect).toHaveBeenCalledWith('id-item-teste');
  });

  it('chama onToggleFavorite ao clicar no botão de favorito, sem disparar onSelect', () => {
    const onSelect = vi.fn();
    const onToggleFavorite = vi.fn();
    render(<CredentialListItem credential={sampleCredential()} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />);
    fireEvent.click(screen.getByRole('button', { name: /favorito/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith('id-item-teste');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
