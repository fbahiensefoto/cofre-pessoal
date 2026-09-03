import { useState } from 'preact/hooks';
import type { Credential } from '../../core/model/credential';
import { useVaultSession } from '../state/VaultSessionContext';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { ConfirmDialog } from '../components/ConfirmDialog';

type FormData = Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>;

const CATEGORIAS = ['Pessoal', 'Trabalho', 'Financeiro', 'Compras', 'Redes Sociais', 'E-mail', 'Terceiros', 'Outros'];

function emptyForm(): FormData {
  return { serviceName: '', category: '', url: '', username: '', password: '', notes: '', tags: [], favorite: false };
}

export function CredentialFormScreen(props: { credentialId?: string; onDone: () => void; onCancel: () => void }) {
  const { credentials, addCredential, updateCredential, deleteCredential } = useVaultSession();
  const existente = props.credentialId ? credentials.find((c) => c.id === props.credentialId) : undefined;
  // Credenciais criadas antes da categoria virar uma lista fixa podem ter um valor fora
  // dela — preservamos como opção extra em vez de trocar silenciosamente ao editar.
  const categoriaForaDaLista = existente && !CATEGORIAS.includes(existente.category) ? existente.category : null;

  const [form, setForm] = useState<FormData>(
    existente
      ? {
          serviceName: existente.serviceName,
          category: existente.category,
          url: existente.url ?? '',
          username: existente.username ?? '',
          password: existente.password,
          notes: existente.notes ?? '',
          tags: existente.tags,
          favorite: existente.favorite,
        }
      : emptyForm(),
  );
  const [tagsTexto, setTagsTexto] = useState(existente ? existente.tags.join(', ') : '');
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setErro(null);
    setSalvando(true);
    const dados: FormData = {
      ...form,
      tags: tagsTexto
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };
    try {
      if (props.credentialId) {
        await updateCredential(props.credentialId, dados);
      } else {
        await addCredential(dados);
      }
      props.onDone();
    } catch {
      setErro('Não foi possível salvar a credencial. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleConfirmDelete() {
    if (!props.credentialId) return;
    setErro(null);
    try {
      await deleteCredential(props.credentialId);
      props.onDone();
    } catch {
      setErro('Não foi possível excluir a credencial. Tente novamente.');
    }
  }

  return (
    <div>
      <h1>{props.credentialId ? 'Editar credencial' : 'Nova credencial'}</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="nome-servico">Nome do serviço</label>
        <input
          id="nome-servico"
          required
          value={form.serviceName}
          onInput={(e) => updateField('serviceName', (e.target as HTMLInputElement).value)}
        />

        <label htmlFor="categoria">Categoria</label>
        <select
          id="categoria"
          required
          value={form.category}
          onChange={(e) => updateField('category', (e.target as HTMLSelectElement).value)}
        >
          <option value="" disabled>
            Selecione uma categoria
          </option>
          {categoriaForaDaLista && <option value={categoriaForaDaLista}>{categoriaForaDaLista}</option>}
          {CATEGORIAS.map((categoria) => (
            <option key={categoria} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>

        <label htmlFor="url">Site</label>
        <input id="url" value={form.url} onInput={(e) => updateField('url', (e.target as HTMLInputElement).value)} />

        <label htmlFor="usuario">Usuário ou e-mail</label>
        <input id="usuario" value={form.username} onInput={(e) => updateField('username', (e.target as HTMLInputElement).value)} />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="text"
          required
          value={form.password}
          onInput={(e) => updateField('password', (e.target as HTMLInputElement).value)}
        />
        <PasswordStrengthMeter password={form.password} />

        <label htmlFor="tags">Tags (separadas por vírgula)</label>
        <input id="tags" value={tagsTexto} onInput={(e) => setTagsTexto((e.target as HTMLInputElement).value)} />

        <label htmlFor="observacoes">Observações</label>
        <textarea id="observacoes" value={form.notes} onInput={(e) => updateField('notes', (e.target as HTMLTextAreaElement).value)} />

        <label htmlFor="favorito">
          <input
            id="favorito"
            type="checkbox"
            checked={form.favorite}
            onChange={(e) => updateField('favorite', (e.target as HTMLInputElement).checked)}
          />
          Favorito
        </label>

        {erro && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {erro}
          </p>
        )}

        <button type="submit" disabled={salvando}>
          Salvar
        </button>
        {!confirmandoExclusao && (
          <button type="button" onClick={props.onCancel}>
            Cancelar
          </button>
        )}

        {props.credentialId && (
          <button type="button" onClick={() => setConfirmandoExclusao(true)} style={{ color: 'var(--color-danger)' }}>
            Excluir
          </button>
        )}
      </form>

      <ConfirmDialog
        open={confirmandoExclusao}
        title="Excluir credencial"
        message="Essa ação não pode ser desfeita. Tem certeza que deseja excluir esta credencial?"
        onConfirm={() => {
          setConfirmandoExclusao(false);
          void handleConfirmDelete();
        }}
        onCancel={() => setConfirmandoExclusao(false)}
      />
    </div>
  );
}
