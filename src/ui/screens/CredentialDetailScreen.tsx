import { useRef, useState } from 'preact/hooks';
import { useVaultSession } from '../state/VaultSessionContext';
import { CategoryBadge } from '../components/CategoryBadge';
import { TagList } from '../components/TagList';
import { ChevronLeftIcon } from '../components/icons';
import { copyToClipboard } from '../lib/clipboard';

type CampoCopiado = 'site' | 'usuario' | 'senha' | null;

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
      <div className="screen">
        <p>Credencial não encontrada.</p>
        <button type="button" className="btn btn--ghost" onClick={props.onBack}>
          <ChevronLeftIcon /> Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <button type="button" className="btn btn--ghost" onClick={props.onBack}>
          <ChevronLeftIcon /> Voltar
        </button>
        <h1>{credencial.serviceName}</h1>
      </div>
      {credencial.owner && (
        <div className="field">
          <strong className="field__label">Pessoa:</strong>
          <span className="field__value">{credencial.owner}</span>
        </div>
      )}
      <CategoryBadge category={credencial.category} />
      <TagList tags={credencial.tags} />

      {credencial.url && (
        <>
          <div className="field">
            <strong className="field__label">Site:</strong>
            <span className="field__value">{credencial.url}</span>
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            data-copied={copiado === 'site'}
            onClick={() => handleCopy('site', credencial.url!)}
          >
            {copiado === 'site' ? 'Copiado!' : 'Copiar site'}
          </button>
        </>
      )}
      {credencial.username && (
        <>
          <div className="field">
            <strong className="field__label">Usuário:</strong>
            <span className="field__value field__value--mono">{credencial.username}</span>
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            data-copied={copiado === 'usuario'}
            onClick={() => handleCopy('usuario', credencial.username!)}
          >
            {copiado === 'usuario' ? 'Copiado!' : 'Copiar usuário'}
          </button>
        </>
      )}

      {credencial.password && (
        <>
          <div className="field">
            <strong className="field__label">Senha:</strong>
            <span className="display-wrap">
              <span className="field-control display">
                <span key={String(senhaVisivel)} className="display__text" data-revealed={senhaVisivel} data-masked={!senhaVisivel}>
                  {senhaVisivel ? credencial.password : '••••••••'}
                </span>
              </span>
            </span>
          </div>
          <div className="actions">
            <button type="button" className="btn btn--secondary" onClick={() => setSenhaVisivel((v) => !v)}>
              {senhaVisivel ? 'Ocultar senha' : 'Revelar senha'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              data-copied={copiado === 'senha'}
              onClick={() => handleCopy('senha', credencial.password)}
            >
              {copiado === 'senha' ? 'Copiado!' : 'Copiar senha'}
            </button>
          </div>
        </>
      )}

      {credencial.loginProvider && (
        <div className="field">
          <strong className="field__label">Login com:</strong>
          <span className="field__value">{credencial.loginProvider}</span>
        </div>
      )}

      {credencial.notes && (
        <div className="field">
          <strong className="field__label">Observações:</strong>
          <span className="field__value">{credencial.notes}</span>
        </div>
      )}

      <button type="button" className="btn btn--secondary btn--block" onClick={() => props.onEdit(credencial.id)}>
        Editar
      </button>
    </div>
  );
}
