import { useMemo, useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';

export function PeopleScreen(props: { onSelectPerson: (name: string) => void; onOpenSettings: () => void }) {
  const { people, credentials, addPerson } = useVaultSession();
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pessoasOrdenadas = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [people]);

  const pessoasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo === '') {
      return pessoasOrdenadas;
    }
    return pessoasOrdenadas.filter((p) => p.name.toLowerCase().includes(termo));
  }, [pessoasOrdenadas, busca]);

  function contarCredenciais(nomePessoa: string): number {
    return credentials.filter((c) => c.owner === nomePessoa).length;
  }

  async function handleAddPerson(event: Event) {
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
      // Fica na tela de Pessoas: a pessoa recém-criada aparecer na lista já é a
      // confirmação. Pular direto pra página dela (vazia) fazia parecer que
      // cadastrar não tinha funcionado.
      await addPerson(nomeNormalizado);
      setNome('');
    } catch {
      setErro('Não foi possível cadastrar a pessoa. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Cofre Pessoal</h1>
        <button type="button" onClick={props.onOpenSettings} aria-label="Configurações">
          ⚙
        </button>
      </header>

      <label htmlFor="busca-pessoas">Pesquisar pessoa</label>
      <input id="busca-pessoas" type="search" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} />

      {pessoasFiltradas.length === 0 ? (
        <p>Nenhuma pessoa encontrada.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {pessoasFiltradas.map((pessoa) => (
            <li key={pessoa.id} style={{ borderBottom: '1px solid var(--color-accent)' }}>
              <button
                type="button"
                onClick={() => props.onSelectPerson(pessoa.name)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '44px', padding: '8px 0' }}
              >
                <span>{pessoa.name}</span>
                <span style={{ color: 'var(--color-accent)', fontSize: '0.85em' }}>
                  {contarCredenciais(pessoa.name)} {contarCredenciais(pessoa.name) === 1 ? 'credencial' : 'credenciais'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAddPerson}>
        <label htmlFor="nome-pessoa">Nova pessoa</label>
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
