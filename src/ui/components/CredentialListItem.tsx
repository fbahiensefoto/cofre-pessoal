import type { Credential } from '../../core/model/credential';
import { CategoryBadge } from './CategoryBadge';
import { TagList } from './TagList';
import { StarIcon, StarOutlineIcon } from './icons';

export function CredentialListItem(props: {
  credential: Credential;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => Promise<void> | void;
}) {
  const { credential } = props;

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-accent)',
        borderRadius: '10px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <button
        type="button"
        aria-label={credential.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
        onClick={(e) => {
          e.stopPropagation();
          // onToggleFavorite pode devolver uma Promise (o toggleFavorite real do
          // VaultSessionContext devolve); um item de lista não é o lugar certo
          // para mostrar erro de uma ação de baixo risco como favoritar — só não
          // podemos deixar a rejeição sem tratamento nenhum.
          Promise.resolve(props.onToggleFavorite(credential.id)).catch(() => {});
        }}
        style={{ minWidth: '44px', minHeight: '44px', background: 'transparent', border: 'none', boxShadow: 'none' }}
      >
        {credential.favorite ? <StarIcon /> : <StarOutlineIcon />}
      </button>
      <button
        type="button"
        onClick={() => props.onSelect(credential.id)}
        style={{
          flex: 1,
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: '4px',
          minHeight: '44px',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
      >
        <span>{credential.serviceName}</span>
        <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <CategoryBadge category={credential.category} />
          <TagList tags={credential.tags} />
        </span>
      </button>
    </li>
  );
}
