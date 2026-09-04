import { useMemo, useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';
import { GearIcon } from '../components/icons';
import { detalheDoErro } from '../lib/errorMessage';

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
    } catch (e) {
      setErro(`Não foi possível cadastrar a pessoa. Tente novamente. (${detalheDoErro(e)})`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head__row">
          <h1>Cofre Pessoal</h1>
          <button type="button" className="btn btn--icon" onClick={props.onOpenSettings} aria-label="Configurações">
            <GearIcon />
          </button>
        </div>
      </header>

      <label htmlFor="busca-pessoas">Pesquisar pessoa</label>
      <input
        id="busca-pessoas"
        type="search"
        className="field-control field-control--search"
        value={busca}
        onInput={(e) => setBusca((e.target as HTMLInputElement).value)}
      />

      {pessoasFiltradas.length === 0 ? (
        <p className="empty">Nenhuma pessoa encontrada.</p>
      ) : (
        <ul className="card-list">
          {pessoasFiltradas.map((pessoa) => (
            <li key={pessoa.id}>
              <button type="button" className="card-person" onClick={() => props.onSelectPerson(pessoa.name)}>
                <span>{pessoa.name}</span>
                <span className="card-person__count">
                  {contarCredenciais(pessoa.name)} {contarCredenciais(pessoa.name) === 1 ? 'credencial' : 'credenciais'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAddPerson}>
        <label htmlFor="nome-pessoa">Nova pessoa</label>
        <input id="nome-pessoa" className="field-control" value={nome} onInput={(e) => setNome((e.target as HTMLInputElement).value)} />

        {erro && (
          <p role="alert" className="msg msg--error">
            {erro}
          </p>
        )}

        <button type="submit" className="btn btn--secondary" disabled={salvando}>
          Cadastrar
        </button>
      </form>
    </div>
  );
}
