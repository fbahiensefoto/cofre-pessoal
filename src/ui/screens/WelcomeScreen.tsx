import { useState } from 'preact/hooks';
import type { Sodium } from '../../core/crypto/sodiumProvider';
import { interactiveParams } from '../../core/crypto/keyDerivation';
import type { Credential } from '../../core/model/credential';
import type { Person } from '../../core/model/person';
import type { VaultRepository, VaultSession } from '../../core/vault/vaultRepository';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { detalheDoErro } from '../lib/errorMessage';

export function WelcomeScreen(props: {
  repository: VaultRepository;
  sodium: Sodium;
  onCreated: (result: { session: VaultSession; people: Person[]; credentials: Credential[] }) => void;
}) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setErro(null);

    if (senha.length === 0) {
      setErro('Digite uma senha mestra.');
      return;
    }
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCriando(true);
    try {
      const params = interactiveParams(props.sodium);
      await props.repository.createVault(senha, params);
      const result = await props.repository.openSession(senha);
      props.onCreated(result);
    } catch (e) {
      setErro(`Não foi possível criar o cofre. Tente novamente. (${detalheDoErro(e)})`);
    } finally {
      setCriando(false);
    }
  }

  return (
    <div>
      <h1>Bem-vindo ao Cofre Pessoal</h1>
      <p>
        Crie uma senha mestra para proteger suas credenciais. Recomendamos uma frase longa, fácil de lembrar — não
        exigimos caracteres especiais nem regras artificiais. Essa senha não pode ser recuperada por ninguém: guarde-a
        bem.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="senha-mestra">Crie uma senha mestra</label>
        <input
          id="senha-mestra"
          type="password"
          value={senha}
          onInput={(e) => setSenha((e.target as HTMLInputElement).value)}
        />
        <PasswordStrengthMeter password={senha} />

        <label htmlFor="confirmar-senha-mestra">Confirme a senha mestra</label>
        <input
          id="confirmar-senha-mestra"
          type="password"
          value={confirmacao}
          onInput={(e) => setConfirmacao((e.target as HTMLInputElement).value)}
        />

        {erro && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {erro}
          </p>
        )}

        <button type="submit" disabled={criando}>
          Criar cofre
        </button>
      </form>
    </div>
  );
}
