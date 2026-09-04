import { useState } from 'preact/hooks';
import type { Credential } from '../../core/model/credential';
import type { Person } from '../../core/model/person';
import type { VaultRepository, VaultSession } from '../../core/vault/vaultRepository';
import { LockGlyph } from '../components/icons';

export function UnlockScreen(props: {
  repository: VaultRepository;
  onUnlocked: (result: { session: VaultSession; people: Person[]; credentials: Credential[] }) => void;
}) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [desbloqueando, setDesbloqueando] = useState(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setErro(null);
    setDesbloqueando(true);
    try {
      const result = await props.repository.openSession(senha);
      props.onUnlocked(result);
    } catch {
      setErro('Senha incorreta.');
    } finally {
      setDesbloqueando(false);
    }
  }

  return (
    <div className="screen screen--centered">
      <LockGlyph />
      <div className="screen-head">
        <h1>Cofre Pessoal</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="senha-desbloqueio">Senha mestra</label>
        <span className="display-wrap">
          <input
            id="senha-desbloqueio"
            type="password"
            className="field-control display"
            value={senha}
            onInput={(e) => setSenha((e.target as HTMLInputElement).value)}
          />
        </span>

        {erro && (
          <p role="alert" className="msg msg--error">
            {erro}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={desbloqueando}>
          Desbloquear
        </button>
      </form>
    </div>
  );
}
