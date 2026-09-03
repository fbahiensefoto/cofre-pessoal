import { useState } from 'preact/hooks';
import type { Credential } from '../../core/model/credential';
import { useVaultSession } from '../state/VaultSessionContext';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { ConfirmDialog } from '../components/ConfirmDialog';

type FormData = Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>;

const CATEGORIAS = ['Pessoal', 'Trabalho', 'Financeiro', 'Compras', 'Redes Sociais', 'E-mail', 'Terceiros', 'Outros'];

function emptyForm(): FormData {
  return {
    owner: '',
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

export function CredentialFormScreen(props: { credentialId?: string; onDone: () => void; onCancel: () => void }) {
  const { credentials, addCredential, updateCredential, deleteCredential } = useVaultSession();
  const existente = props.credentialId ? credentials.find((c) => c.id === props.credentialId) : undefined;
  // Credenciais criadas antes da categoria virar uma lista fixa podem ter um valor fora
  // dela — preservamos como opção extra em vez de trocar silenciosamente ao editar.
  const categoriaForaDaLista = existente && !CATEGORIAS.includes(existente.category) ? existente.category : null;
  // "Pessoa" não é uma lista fixa como Categoria — cresce com o uso, é específica de
  // cada usuário. A lista de opções vem das próprias credenciais já cadastradas.
  const pessoasExistentes = [...new Set(credentials.map((c) => c.owner).filter((nome): nome is string => Boolean(nome)))].sort(
    (a, b) => a.localeCompare(b, 'pt-BR'),
  );

  const ownerInicial = existente?.owner ?? '';
  const [form, setForm] = useState<FormData>(
    existente
      ? {
          owner: ownerInicial,
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
  // Só começa no modo "nova pessoa" (campo de texto) quando já existe um valor
  // definido que não está entre as pessoas conhecidas — nunca por padrão numa
  // credencial nova ou numa antiga sem pessoa: nesses casos mostramos o select.
  const [novaPessoa, setNovaPessoa] = useState(ownerInicial !== '' && !pessoasExistentes.includes(ownerInicial));
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
        <label htmlFor="pessoa">Pessoa</label>
        {pessoasExistentes.length > 0 ? (
          <select
            id="pessoa"
            required
            value={novaPessoa ? '__nova__' : form.owner}
            onChange={(e) => {
              const valor = (e.target as HTMLSelectElement).value;
              if (valor === '__nova__') {
                setNovaPessoa(true);
                updateField('owner', '');
              } else {
                setNovaPessoa(false);
                updateField('owner', valor);
              }
            }}
          >
            <option value="" disabled>
              Selecione uma pessoa
            </option>
            {pessoasExistentes.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
            <option value="__nova__">+ Nova pessoa</option>
          </select>
        ) : (
          <input id="pessoa" required value={form.owner} onInput={(e) => updateField('owner', (e.target as HTMLInputElement).value)} />
        )}
        {pessoasExistentes.length > 0 && novaPessoa && (
          <input
            id="pessoa-nova"
            aria-label="Nome da nova pessoa"
            required
            placeholder="Nome da pessoa"
            value={form.owner}
            onInput={(e) => updateField('owner', (e.target as HTMLInputElement).value)}
          />
        )}

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
