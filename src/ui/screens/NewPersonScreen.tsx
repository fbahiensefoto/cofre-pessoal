import { useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';

export function NewPersonScreen(props: { onCreated: (personName: string) => void; onCancel: () => void }) {
  const { people, addPerson } = useVaultSession();
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setErro(null);

    const nomeNormalizado = nome.trim();
    if (nomeNormalizado.length === 0) {
      setErro('Digite o nome da pessoa.');
      return;
    }
    const jaExiste = people.some((p) => p.name.trim().toLowerCase() === nomeNormalizado.toLowerCase());
    if (jaExiste) {
      setErro('Essa pessoa já está cadastrada.');
      return;
    }

    setSalvando(true);
    try {
      const pessoa = await addPerson(nomeNormalizado);
      props.onCreated(pessoa.name);
    } catch {
      setErro('Não foi possível cadastrar a pessoa. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={props.onCancel}>
        ← Voltar
      </button>
      <h1>Nova pessoa</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="nome-pessoa">Nome</label>
        <input id="nome-pessoa" value={nome} onInput={(e) => setNome((e.target as HTMLInputElement).value)} />

        {erro && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {erro}
          </p>
        )}

        <button type="submit" disabled={salvando}>
          Cadastrar
        </button>
      </form>
    </div>
  );
}
