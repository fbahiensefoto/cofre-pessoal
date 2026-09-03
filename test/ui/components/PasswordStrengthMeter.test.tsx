// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { PasswordStrengthMeter } from '../../../src/ui/components/PasswordStrengthMeter';

describe('PasswordStrengthMeter', () => {
  it('mostra o rótulo correspondente à força da senha', () => {
    render(<PasswordStrengthMeter password="cavalo-azul-correndo-no-campo-verde-2026!" />);
    expect(screen.getByText(/muito forte/i)).toBeTruthy();
  });

  it('reage a mudanças de senha', () => {
    const { rerender } = render(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByText(/fraca/i)).toBeTruthy();

    rerender(<PasswordStrengthMeter password="cavalo-azul-correndo-no-campo-verde-2026!" />);
    expect(screen.getByText(/muito forte/i)).toBeTruthy();
  });
});
