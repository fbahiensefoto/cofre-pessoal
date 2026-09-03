import { useMemo, useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';

export function PeopleScreen(props: { onSelectPerson: (name: string) => void; onAddPerson: () => void; onOpenSettings: () => void }) {
  const { people, credentials } = useVaultSession();
  const [busca, setBusca] = useState('');

  const pessoasOrdenadas = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [people]);

  const pessoasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo === '') {
      return pessoasOrdenadas;
    }
    return pessoasOrdenadas.filter((p) => p.name.toLowerCase().includes(termo));
  }, [pessoasOrdenadas, busca]);

  function contarCredenciais(nome: string): number {
    return credentials.filter((c) => c.owner === nome).length;
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
            <li key={pessoa.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button
                type="button"
                onClick={() => props.onSelectPerson(pessoa.name)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '44px', padding: '8px 0' }}
              >
                <span>{pessoa.name}</span>
                <span style={{ color: 'var(--color-border)', fontSize: '0.85em' }}>
                  {contarCredenciais(pessoa.name)} {contarCredenciais(pessoa.name) === 1 ? 'credencial' : 'credenciais'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={props.onAddPerson}>
        + Nova pessoa
      </button>
    </div>
  );
}
