import { useMemo, useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';
import { CredentialListItem } from '../components/CredentialListItem';
import { ChevronLeftIcon } from '../components/icons';

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
    <div className="screen">
      <div className="screen-head">
        <button type="button" className="btn btn--ghost" onClick={props.onBack}>
          <ChevronLeftIcon /> Voltar
        </button>
        <h1>{props.owner}</h1>
      </div>

      <label htmlFor="busca-credenciais">Pesquisar</label>
      <input
        id="busca-credenciais"
        type="search"
        className="field-control field-control--search"
        value={busca}
        onInput={(e) => setBusca((e.target as HTMLInputElement).value)}
      />

      {filtradas.length === 0 ? (
        <p className="empty">Nenhuma credencial encontrada.</p>
      ) : (
        <ul className="card-list">
          {filtradas.map((c) => (
            <CredentialListItem key={c.id} credential={c} onSelect={props.onSelectCredential} onToggleFavorite={toggleFavorite} />
          ))}
        </ul>
      )}

      <button type="button" className="btn btn--primary btn--block" onClick={props.onCreateNew}>
        Adicionar credencial
      </button>
    </div>
  );
}
