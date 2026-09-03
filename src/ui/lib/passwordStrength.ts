export type StrengthLevel = 'fraca' | 'razoável' | 'forte' | 'muito forte';

function countCharacterClasses(password: string): number {
  let classes = 0;
  if (/[a-z]/.test(password)) classes += 1;
  if (/[A-Z]/.test(password)) classes += 1;
  if (/[0-9]/.test(password)) classes += 1;
  if (/[^a-zA-Z0-9\s]/.test(password)) classes += 1;
  return classes;
}

export function evaluatePasswordStrength(password: string): StrengthLevel {
  const length = password.length;
  const classes = countCharacterClasses(password);

  if (length < 8) {
    return 'fraca';
  }
  if (length >= 20 && classes >= 3) {
    return 'muito forte';
  }
  if (length >= 16 || (length >= 12 && classes >= 3)) {
    return 'forte';
  }
  if (length >= 12 || (length >= 8 && classes >= 2)) {
    return 'razoável';
  }
  return 'fraca';
}
