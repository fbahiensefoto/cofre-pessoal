import { evaluatePasswordStrength, type StrengthLevel } from '../lib/passwordStrength';

const NIVEL_PARA_LARGURA: Record<StrengthLevel, string> = {
  fraca: '25%',
  'razoável': '50%',
  forte: '75%',
  'muito forte': '100%',
};

// Deriva a ordem dos níveis do próprio Record acima (em vez de repetir um
// segundo array literal) para que as duas listas não possam divergir.
const NIVEIS = Object.keys(NIVEL_PARA_LARGURA) as StrengthLevel[];

export function PasswordStrengthMeter(props: { password: string }) {
  const nivel = evaluatePasswordStrength(props.password);
  const largura = NIVEL_PARA_LARGURA[nivel];

  return (
    <div>
      <div
        role="progressbar"
        aria-label="Força da senha"
        aria-valuenow={NIVEIS.indexOf(nivel) + 1}
        aria-valuemin={1}
        aria-valuemax={4}
        style={{ background: 'var(--color-border)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}
      >
        <div style={{ width: largura, height: '100%', background: 'var(--color-primary)' }} />
      </div>
      <span>Força: {nivel}</span>
    </div>
  );
}
