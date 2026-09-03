import { useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';
import { CategoryBadge } from '../components/CategoryBadge';
import { TagList } from '../components/TagList';

export function CredentialDetailScreen(props: { credentialId: string; onBack: () => void; onEdit: (id: string) => void }) {
  const { credentials } = useVaultSession();
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const credencial = credentials.find((c) => c.id === props.credentialId);
  if (!credencial) {
    return (
      <div>
        <p>Credencial não encontrada.</p>
        <button type="button" onClick={props.onBack}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={props.onBack}>
        ← Voltar
      </button>
      <h1>{credencial.serviceName}</h1>
      {credencial.owner && (
        <p>
          <strong>Pessoa:</strong> {credencial.owner}
        </p>
      )}
      <CategoryBadge category={credencial.category} />
      <TagList tags={credencial.tags} />

      {credencial.url && (
        <p>
          <strong>Site:</strong> {credencial.url}
        </p>
      )}
      {credencial.username && (
        <p>
          <strong>Usuário:</strong> {credencial.username}
        </p>
      )}

      <p>
        <strong>Senha:</strong> {senhaVisivel ? credencial.password : '••••••••'}
      </p>
      <button type="button" onClick={() => setSenhaVisivel((v) => !v)}>
        {senhaVisivel ? 'Ocultar senha' : 'Revelar senha'}
      </button>

      {credencial.notes && (
        <p>
          <strong>Observações:</strong> {credencial.notes}
        </p>
      )}

      <button type="button" onClick={() => props.onEdit(credencial.id)}>
        Editar
      </button>
    </div>
  );
}
