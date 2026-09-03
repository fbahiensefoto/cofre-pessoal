import { useRef, useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';
import { CategoryBadge } from '../components/CategoryBadge';
import { TagList } from '../components/TagList';
import { ChevronLeftIcon } from '../components/icons';
import { copyToClipboard } from '../lib/clipboard';

type CampoCopiado = 'usuario' | 'senha' | null;

export function CredentialDetailScreen(props: { credentialId: string; onBack: () => void; onEdit: (id: string) => void }) {
  const { credentials } = useVaultSession();
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [copiado, setCopiado] = useState<CampoCopiado>(null);
  const limparCopiadoRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleCopy(campo: Exclude<CampoCopiado, null>, valor: string) {
    copyToClipboard(valor)
      .then((sucesso) => {
        if (!sucesso) return;
        setCopiado(campo);
        clearTimeout(limparCopiadoRef.current);
        limparCopiadoRef.current = setTimeout(() => setCopiado(null), 2000);
      })
      .catch(() => {});
  }

  const credencial = credentials.find((c) => c.id === props.credentialId);
  if (!credencial) {
    return (
      <div>
        <p>Credencial não encontrada.</p>
        <button type="button" onClick={props.onBack}>
          <ChevronLeftIcon /> Voltar
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={props.onBack}>
        <ChevronLeftIcon /> Voltar
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
        <>
          <p>
            <strong>Usuário:</strong> {credencial.username}
          </p>
          <button type="button" onClick={() => handleCopy('usuario', credencial.username!)}>
            {copiado === 'usuario' ? 'Copiado!' : 'Copiar usuário'}
          </button>
        </>
      )}

      <p>
        <strong>Senha:</strong>{' '}
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.04em' }}>
          {senhaVisivel ? credencial.password : '••••••••'}
        </span>
      </p>
      <button type="button" onClick={() => setSenhaVisivel((v) => !v)}>
        {senhaVisivel ? 'Ocultar senha' : 'Revelar senha'}
      </button>
      <button type="button" onClick={() => handleCopy('senha', credencial.password)}>
        {copiado === 'senha' ? 'Copiado!' : 'Copiar senha'}
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
