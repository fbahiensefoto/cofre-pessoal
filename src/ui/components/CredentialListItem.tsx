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
    <li className="card-cred">
      <button
        type="button"
        className="btn btn--icon"
        data-favorite={credential.favorite}
        aria-label={credential.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
        onClick={(e) => {
          e.stopPropagation();
          // onToggleFavorite pode devolver uma Promise (o toggleFavorite real do
          // VaultSessionContext devolve); um item de lista não é o lugar certo
          // para mostrar erro de uma ação de baixo risco como favoritar — só não
          // podemos deixar a rejeição sem tratamento nenhum.
          Promise.resolve(props.onToggleFavorite(credential.id)).catch(() => {});
        }}
      >
        {credential.favorite ? <StarIcon /> : <StarOutlineIcon />}
      </button>
      <button type="button" className="card-cred__main" onClick={() => props.onSelect(credential.id)}>
        <span>{credential.serviceName}</span>
        <span className="card-cred__meta">
          <CategoryBadge category={credential.category} />
          <TagList tags={credential.tags} />
        </span>
      </button>
    </li>
  );
}
