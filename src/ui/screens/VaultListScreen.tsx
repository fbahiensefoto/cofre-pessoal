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

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo === '') {
      return credentials;
    }
    return credentials.filter(
      (c) =>
        c.serviceName.toLowerCase().includes(termo) ||
        c.category.toLowerCase().includes(termo) ||
        c.tags.some((t) => t.toLowerCase().includes(termo)),
    );
  }, [credentials, busca]);

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
