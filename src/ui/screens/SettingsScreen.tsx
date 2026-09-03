import { useState } from 'preact/hooks';
import { interactiveParams } from '../../core/crypto/keyDerivation';
import type { VaultRepository } from '../../core/vault/vaultRepository';
import { useTheme } from '../lib/useTheme';
import { useVaultSession } from '../state/VaultSessionContext';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { ChevronLeftIcon } from '../components/icons';

export function SettingsScreen(props: { repository: VaultRepository; onBack: () => void }) {
  const { preference, setPreference } = useTheme();
  const { lock } = useVaultSession();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  async function handleChangePassword(event: Event) {
    event.preventDefault();
    setErro(null);
    setMensagem(null);

    if (novaSenha.length === 0) {
      setErro('Digite a nova senha.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setTrocando(true);
    try {
      // Mesmos parâmetros "interactive" já usados na criação do cofre (WelcomeScreen).
      const params = interactiveParams(props.repository.sodiumInstance);
      await props.repository.changeMasterPassword(senhaAtual, novaSenha, params);
      setMensagem('Senha alterada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
    } catch {
      setErro('Não foi possível trocar a senha. Confira a senha atual.');
    } finally {
      setTrocando(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={props.onBack}>
        <ChevronLeftIcon /> Voltar
      </button>
      <h1>Configurações</h1>

      <section>
        <h2>Tema</h2>
        <label>
          <input type="radio" name="tema" checked={preference === 'auto'} onChange={() => setPreference('auto')} />
          Automático
        </label>
        <label>
          <input
            aria-label="Tema claro"
            type="radio"
            name="tema"
            checked={preference === 'light'}
            onChange={() => setPreference('light')}
          />
          Claro
        </label>
        <label>
          <input
            aria-label="Tema escuro"
            type="radio"
            name="tema"
            checked={preference === 'dark'}
            onChange={() => setPreference('dark')}
          />
          Escuro
        </label>
      </section>

      <section>
        <h2>Trocar senha mestra</h2>
        <form onSubmit={handleChangePassword}>
          <label htmlFor="senha-atual">Senha atual</label>
          <input
            id="senha-atual"
            type="password"
            value={senhaAtual}
            onInput={(e) => setSenhaAtual((e.target as HTMLInputElement).value)}
          />

          <label htmlFor="nova-senha">Nova senha</label>
          <input
            id="nova-senha"
            type="password"
            value={novaSenha}
            onInput={(e) => setNovaSenha((e.target as HTMLInputElement).value)}
          />
          <PasswordStrengthMeter password={novaSenha} />

          <label htmlFor="confirmar-nova-senha">Confirme a nova senha</label>
          <input
            id="confirmar-nova-senha"
            type="password"
            value={confirmarNovaSenha}
            onInput={(e) => setConfirmarNovaSenha((e.target as HTMLInputElement).value)}
          />

          {erro && (
            <p role="alert" style={{ color: 'var(--color-danger)' }}>
              {erro}
            </p>
          )}
          {mensagem && <p>{mensagem}</p>}

          <button type="submit" disabled={trocando}>
            Trocar senha
          </button>
        </form>
      </section>

      <button type="button" onClick={lock}>
        Bloquear cofre
      </button>
    </div>
  );
}
