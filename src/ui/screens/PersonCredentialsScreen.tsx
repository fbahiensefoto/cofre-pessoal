import { useMemo, useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';
import { CredentialListItem } from '../components/CredentialListItem';

export function PersonCredentialsScreen(props: {
  owner: string;
  onBack: () => void;
  onSelectCredential: (id: string) => void;
  onCreateNew: () => void;
}) {
  const { credentials, toggleFavorite } = useVaultSession();
  const [busca, setBusca] = useState('');

  const credenciaisDaPessoa = useMemo(() => credentials.filter((c) => c.owner === props.owner), [credentials, props.owner]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo === '') {
      return credenciaisDaPessoa;
    }
    return credenciaisDaPessoa.filter(
      (c) =>
        c.serviceName.toLowerCase().includes(termo) ||
        c.category.toLowerCase().includes(termo) ||
        c.tags.some((t) => t.toLowerCase().includes(termo)),
    );
  }, [credenciaisDaPessoa, busca]);

  return (
    <div>
      <button type="button" onClick={props.onBack}>
        ← Voltar
      </button>
      <h1>{props.owner}</h1>

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
            <CredentialListItem key={c.id} credential={c} onSelect={props.onSelectCredential} onToggleFavorite={toggleFavorite} showOwner={false} />
          ))}
        </ul>
      )}

      <button type="button" onClick={props.onCreateNew}>
        Adicionar credencial
      </button>
    </div>
  );
}
