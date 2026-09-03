import { useMemo, useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';
import { CredentialListItem } from '../components/CredentialListItem';

export function VaultListScreen(props: {
  onSelectCredential: (id: string) => void;
  onCreateNew: () => void;
  onOpenSettings: () => void;
}) {
  const { credentials, toggleFavorite } = useVaultSession();
  const [busca, setBusca] = useState('');
  const [pessoaFiltro, setPessoaFiltro] = useState<string | null>(null);

  const pessoas = useMemo(() => {
    const distintas = new Set(credentials.map((c) => c.owner).filter((nome): nome is string => Boolean(nome)));
    return [...distintas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [credentials]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return credentials.filter((c) => {
      const combinaBusca =
        termo === '' ||
        c.serviceName.toLowerCase().includes(termo) ||
        c.category.toLowerCase().includes(termo) ||
        (c.owner ?? '').toLowerCase().includes(termo) ||
        c.tags.some((t) => t.toLowerCase().includes(termo));
      const combinaPessoa = pessoaFiltro === null || c.owner === pessoaFiltro;
      return combinaBusca && combinaPessoa;
    });
  }, [credentials, busca, pessoaFiltro]);

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Cofre Pessoal</h1>
        <button type="button" onClick={props.onOpenSettings} aria-label="Configurações">
          ⚙
        </button>
      </header>

      <label htmlFor="busca-credenciais">Pesquisar</label>
      <input
        id="busca-credenciais"
        type="search"
        value={busca}
        onInput={(e) => setBusca((e.target as HTMLInputElement).value)}
      />

      {pessoas.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0' }}>
          <button
            type="button"
            aria-pressed={pessoaFiltro === null}
            onClick={() => setPessoaFiltro(null)}
            style={pessoaFiltro === null ? { background: 'var(--color-primary)', color: 'var(--color-bg)' } : undefined}
          >
            Todos
          </button>
          {pessoas.map((pessoa) => (
            <button
              key={pessoa}
              type="button"
              aria-pressed={pessoaFiltro === pessoa}
              onClick={() => setPessoaFiltro(pessoa)}
              style={pessoaFiltro === pessoa ? { background: 'var(--color-primary)', color: 'var(--color-bg)' } : undefined}
            >
              {pessoa}
            </button>
          ))}
        </div>
      )}

      {filtradas.length === 0 ? (
        <p>Nenhuma credencial encontrada.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {filtradas.map((c) => (
            <CredentialListItem key={c.id} credential={c} onSelect={props.onSelectCredential} onToggleFavorite={toggleFavorite} />
          ))}
        </ul>
      )}

      <button type="button" onClick={props.onCreateNew}>
        Adicionar credencial
      </button>
    </div>
  );
}
