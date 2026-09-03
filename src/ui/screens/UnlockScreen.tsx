import { useState } from 'preact/hooks';
import type { Credential } from '../../core/model/credential';
import type { VaultRepository, VaultSession } from '../../core/vault/vaultRepository';

export function UnlockScreen(props: {
  repository: VaultRepository;
  onUnlocked: (result: { session: VaultSession; credentials: Credential[] }) => void;
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
    <div>
      <h1>Cofre Pessoal</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="senha-desbloqueio">Senha mestra</label>
        <input
          id="senha-desbloqueio"
          type="password"
          value={senha}
          onInput={(e) => setSenha((e.target as HTMLInputElement).value)}
        />

        {erro && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {erro}
          </p>
        )}

        <button type="submit" disabled={desbloqueando}>
          Desbloquear
        </button>
      </form>
    </div>
  );
}
