import type { Credential } from '../../core/model/credential';
import { CategoryBadge } from './CategoryBadge';
import { TagList } from './TagList';

export function CredentialListItem(props: {
  credential: Credential;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => Promise<void> | void;
  /** Esconde o nome da pessoa na linha — usado quando a lista já está toda
   * dentro do contexto de uma única pessoa (repetir o nome seria ruído). */
  showOwner?: boolean;
}) {
  const { credential, showOwner = true } = props;

  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
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
        style={{ minWidth: '44px', minHeight: '44px' }}
      >
        {credential.favorite ? '★' : '☆'}
      </button>
      <button
        type="button"
        onClick={() => props.onSelect(credential.id)}
        style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '44px' }}
      >
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span>{credential.serviceName}</span>
          {showOwner && credential.owner && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85em' }}>{credential.owner}</span>}
        </span>
        <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <CategoryBadge category={credential.category} />
          <TagList tags={credential.tags} />
        </span>
      </button>
    </li>
  );
}
