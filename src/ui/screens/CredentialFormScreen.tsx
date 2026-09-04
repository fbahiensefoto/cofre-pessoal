import { useState } from 'preact/hooks';
import type { Credential } from '../../core/model/credential';
import { useVaultSession } from '../state/VaultSessionContext';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { detalheDoErro } from '../lib/errorMessage';

type FormData = Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>;

const CATEGORIAS = ['Pessoal', 'Trabalho', 'Financeiro', 'Compras', 'Redes Sociais', 'E-mail', 'Terceiros', 'Outros'];

function emptyForm(owner: string): FormData {
  return {
    owner,
    serviceName: '',
    category: '',
    url: '',
    username: '',
    password: '',
    notes: '',
    tags: [],
    favorite: false,
  };
}

export function CredentialFormScreen(props: {
  credentialId?: string;
  initialOwner: string;
  onDone: (savedOwner: string) => void;
  onCancel: () => void;
}) {
  const { people, credentials, addCredential, updateCredential, deleteCredential } = useVaultSession();
  const existente = props.credentialId ? credentials.find((c) => c.id === props.credentialId) : undefined;
  // Credenciais criadas antes da categoria virar uma lista fixa podem ter um valor fora
  // dela — preservamos como opção extra em vez de trocar silenciosamente ao editar.
  const categoriaForaDaLista = existente && !CATEGORIAS.includes(existente.category) ? existente.category : null;
  const pessoasOrdenadas = [...people].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const [form, setForm] = useState<FormData>(
    existente
      ? {
          owner: existente.owner,
          serviceName: existente.serviceName,
          category: existente.category,
          url: existente.url ?? '',
          username: existente.username ?? '',
          password: existente.password,
          notes: existente.notes ?? '',
          tags: existente.tags,
          favorite: existente.favorite,
        }
      : emptyForm(props.initialOwner),
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
      // Reporta a pessoa realmente salva, não a de quando o formulário abriu —
      // trocar a Pessoa aqui move a credencial para a página dela; navegar de
      // volta para a pessoa antiga a deixaria "sumida" da tela em que estava.
      props.onDone(dados.owner);
    } catch (e) {
      setErro(`Não foi possível salvar a credencial. Tente novamente. (${detalheDoErro(e)})`);
    } finally {
      setSalvando(false);
    }
  }

  async function handleConfirmDelete() {
    if (!props.credentialId) return;
    setErro(null);
    try {
      await deleteCredential(props.credentialId);
      props.onDone(props.initialOwner);
    } catch (e) {
      setErro(`Não foi possível excluir a credencial. Tente novamente. (${detalheDoErro(e)})`);
    }
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>{props.credentialId ? 'Editar credencial' : 'Nova credencial'}</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="pessoa">Pessoa</label>
        <select
          id="pessoa"
          required
          className="field-control"
          value={form.owner}
          onChange={(e) => updateField('owner', (e.target as HTMLSelectElement).value)}
        >
          <option value="" disabled>
            Selecione uma pessoa
          </option>
          {pessoasOrdenadas.map((pessoa) => (
            <option key={pessoa.id} value={pessoa.name}>
              {pessoa.name}
            </option>
          ))}
        </select>

        <label htmlFor="nome-servico">Nome do serviço</label>
        <input
          id="nome-servico"
          required
          className="field-control"
          value={form.serviceName}
          onInput={(e) => updateField('serviceName', (e.target as HTMLInputElement).value)}
        />

        <label htmlFor="categoria">Categoria</label>
        <select
          id="categoria"
          required
          className="field-control"
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
        <input id="url" className="field-control" value={form.url} onInput={(e) => updateField('url', (e.target as HTMLInputElement).value)} />

        <label htmlFor="usuario">Usuário ou e-mail</label>
        <input
          id="usuario"
          className="field-control field-control--mono"
          value={form.username}
          onInput={(e) => updateField('username', (e.target as HTMLInputElement).value)}
        />

        <label htmlFor="senha">Senha</label>
        <span className="display-wrap">
          <input
            id="senha"
            type="text"
            required
            className="field-control display"
            value={form.password}
            onInput={(e) => updateField('password', (e.target as HTMLInputElement).value)}
          />
        </span>
        <PasswordStrengthMeter password={form.password} />

        <label htmlFor="tags">Tags (separadas por vírgula)</label>
        <input id="tags" className="field-control" value={tagsTexto} onInput={(e) => setTagsTexto((e.target as HTMLInputElement).value)} />

        <label htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          className="field-control"
          value={form.notes}
          onInput={(e) => updateField('notes', (e.target as HTMLTextAreaElement).value)}
        />

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
          <p role="alert" className="msg msg--error">
            {erro}
          </p>
        )}

        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={salvando}>
            Salvar
          </button>
          {!confirmandoExclusao && (
            <button type="button" className="btn btn--secondary" onClick={props.onCancel}>
              Cancelar
            </button>
          )}
        </div>

        {props.credentialId && (
          <button type="button" className="btn btn--danger" onClick={() => setConfirmandoExclusao(true)}>
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
