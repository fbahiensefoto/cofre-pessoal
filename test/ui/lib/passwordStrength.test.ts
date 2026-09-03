import { describe, expect, it } from 'vitest';
import { evaluatePasswordStrength } from '../../../src/ui/lib/passwordStrength';

describe('evaluatePasswordStrength', () => {
  it('senha vazia ou muito curta é fraca', () => {
    expect(evaluatePasswordStrength('')).toBe('fraca');
    expect(evaluatePasswordStrength('abc123')).toBe('fraca');
  });

  it('frase-senha longa só com letras minúsculas e espaços é pelo menos razoável', () => {
    const resultado = evaluatePasswordStrength('cavalo azul correndo no campo verde');
    expect(['razoável', 'forte', 'muito forte']).toContain(resultado);
  });

  it('senha curta mas com várias classes de caractere não vira muito forte só por isso', () => {
    expect(evaluatePasswordStrength('Ab1!')).not.toBe('muito forte');
  });

  it('frase-senha longa e com diversidade de caracteres é muito forte', () => {
    const resultado = evaluatePasswordStrength('Cavalo-Azul-Correndo-2026!no-Campo-Verde');
    expect(resultado).toBe('muito forte');
  });

  it('aceita espaços sem erro', () => {
    expect(() => evaluatePasswordStrength('senha com espaços')).not.toThrow();
  });
});
