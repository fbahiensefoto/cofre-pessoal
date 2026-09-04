import { evaluatePasswordStrength, type StrengthLevel } from '../lib/passwordStrength';

const NIVEIS = ['fraca', 'razoável', 'forte', 'muito forte'] satisfies StrengthLevel[];

export function PasswordStrengthMeter(props: { password: string }) {
  const nivel = evaluatePasswordStrength(props.password);
  const nivelNumero = NIVEIS.indexOf(nivel) + 1;

  return (
    <div className="meter">
      <div
        role="progressbar"
        aria-label="Força da senha"
        aria-valuenow={nivelNumero}
        aria-valuemin={1}
        aria-valuemax={4}
        className="meter__track"
        data-level={nivelNumero}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden="true" className="meter__seg" />
        ))}
      </div>
      <span className="meter__label">Força: {nivel}</span>
    </div>
  );
}
