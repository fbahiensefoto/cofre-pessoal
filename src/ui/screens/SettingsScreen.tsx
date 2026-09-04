import { useRef, useState } from 'preact/hooks';
import { interactiveParams } from '../../core/crypto/keyDerivation';
import type { VaultRepository } from '../../core/vault/vaultRepository';
import { useTheme } from '../lib/useTheme';
import { useVaultSession } from '../state/VaultSessionContext';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChevronLeftIcon } from '../components/icons';
import { detalheDoErro } from '../lib/errorMessage';
import { shareOrDownloadBackup, readFileAsBytes } from '../lib/backupFile';

export function SettingsScreen(props: { repository: VaultRepository; onBack: () => void }) {
  const { preference, setPreference } = useTheme();
  const { lock } = useVaultSession();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const [exportando, setExportando] = useState(false);
  const [mensagemBackup, setMensagemBackup] = useState<string | null>(null);
  const [erroBackup, setErroBackup] = useState<string | null>(null);
  const [arquivoParaRestaurar, setArquivoParaRestaurar] = useState<File | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  async function handleChangePassword(event: Event) {
    event.preventDefault();
    setErro(null);
    setMensagem(null);

    if (novaSenha.length === 0) {
      setErro('Digite a nova senha.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setTrocando(true);
    try {
      // Mesmos parâmetros "interactive" já usados na criação do cofre (WelcomeScreen).
      const params = interactiveParams(props.repository.sodiumInstance);
      await props.repository.changeMasterPassword(senhaAtual, novaSenha, params);
      setMensagem('Senha alterada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
    } catch (e) {
      setErro(`Não foi possível trocar a senha. Confira a senha atual. (${detalheDoErro(e)})`);
    } finally {
      setTrocando(false);
    }
  }

  async function handleExportBackup() {
    setErroBackup(null);
    setMensagemBackup(null);
    setExportando(true);
    try {
      const bytes = await props.repository.exportBytes();
      const resultado = await shareOrDownloadBackup(bytes);
      setMensagemBackup(
        resultado === 'compartilhado' ? 'Backup pronto para enviar.' : 'Backup baixado — envie o arquivo de onde ele foi salvo.',
      );
    } catch (e) {
      setErroBackup(`Não foi possível preparar o backup. (${detalheDoErro(e)})`);
    } finally {
      setExportando(false);
    }
  }

  function handleFileSelected(event: Event) {
    const arquivo = (event.target as HTMLInputElement).files?.[0];
    if (arquivo) {
      setErroBackup(null);
      setArquivoParaRestaurar(arquivo);
    }
  }

  function handleCancelRestore() {
    setArquivoParaRestaurar(null);
    if (inputArquivoRef.current) {
      inputArquivoRef.current.value = '';
    }
  }

  async function handleConfirmRestore() {
    if (!arquivoParaRestaurar) return;
    setRestaurando(true);
    setErroBackup(null);
    try {
      const bytes = await readFileAsBytes(arquivoParaRestaurar);
      await props.repository.importBytes(bytes);
      setArquivoParaRestaurar(null);
      if (inputArquivoRef.current) {
        inputArquivoRef.current.value = '';
      }
      // O cofre gravado agora é outro arquivo (senha, dados, tudo) — a
      // sessão em memória não corresponde mais a ele. Bloquear força
      // desbloquear de novo com a senha de quando aquele backup foi feito.
      lock();
    } catch (e) {
      setErroBackup(`Não foi possível restaurar esse arquivo — confira se é um backup do Cofre Pessoal. (${detalheDoErro(e)})`);
      setArquivoParaRestaurar(null);
      if (inputArquivoRef.current) {
        inputArquivoRef.current.value = '';
      }
    } finally {
      setRestaurando(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <button type="button" className="btn btn--ghost" onClick={props.onBack}>
          <ChevronLeftIcon /> Voltar
        </button>
        <h1>Configurações</h1>
      </div>

      <section className="panel">
        <h2>Tema</h2>
        <label>
          <input type="radio" name="tema" checked={preference === 'auto'} onChange={() => setPreference('auto')} />
          Automático
        </label>
        <label>
          <input
            aria-label="Tema claro"
            type="radio"
            name="tema"
            checked={preference === 'light'}
            onChange={() => setPreference('light')}
          />
          Claro
        </label>
        <label>
          <input
            aria-label="Tema escuro"
            type="radio"
            name="tema"
            checked={preference === 'dark'}
            onChange={() => setPreference('dark')}
          />
          Escuro
        </label>
      </section>

      <section className="panel">
        <h2>Backup</h2>
        <p>Uma cópia cifrada de todas as suas pessoas e credenciais, para guardar em outro lugar (ex.: enviar para você mesmo por mensagem).</p>
        <button type="button" className="btn btn--secondary" onClick={handleExportBackup} disabled={exportando}>
          {exportando ? 'Preparando...' : 'Baixar backup'}
        </button>

        <label htmlFor="restaurar-backup">Restaurar de um backup</label>
        <div className="file-picker">
          <button type="button" className="btn btn--secondary" onClick={() => inputArquivoRef.current?.click()}>
            Escolher arquivo
          </button>
          <span className="file-picker__name">{arquivoParaRestaurar ? arquivoParaRestaurar.name : 'Nenhum arquivo selecionado'}</span>
          <input
            id="restaurar-backup"
            ref={inputArquivoRef}
            type="file"
            accept=".cofre"
            className="sr-only"
            onChange={handleFileSelected}
          />
        </div>
        <p className="hint">Substitui tudo que está neste aparelho pelo conteúdo do arquivo escolhido.</p>

        {erroBackup && (
          <p role="alert" className="msg msg--error">
            {erroBackup}
          </p>
        )}
        {mensagemBackup && <p className="msg msg--ok">{mensagemBackup}</p>}
      </section>

      <section className="panel">
        <h2>Trocar senha mestra</h2>
        <form onSubmit={handleChangePassword}>
          <label htmlFor="senha-atual">Senha atual</label>
          <span className="display-wrap">
            <input
              id="senha-atual"
              type="password"
              className="field-control display"
              value={senhaAtual}
              onInput={(e) => setSenhaAtual((e.target as HTMLInputElement).value)}
            />
          </span>

          <label htmlFor="nova-senha">Nova senha</label>
          <span className="display-wrap">
            <input
              id="nova-senha"
              type="password"
              className="field-control display"
              value={novaSenha}
              onInput={(e) => setNovaSenha((e.target as HTMLInputElement).value)}
            />
          </span>
          <PasswordStrengthMeter password={novaSenha} />

          <label htmlFor="confirmar-nova-senha">Confirme a nova senha</label>
          <span className="display-wrap">
            <input
              id="confirmar-nova-senha"
              type="password"
              className="field-control display"
              value={confirmarNovaSenha}
              onInput={(e) => setConfirmarNovaSenha((e.target as HTMLInputElement).value)}
            />
          </span>

          {erro && (
            <p role="alert" className="msg msg--error">
              {erro}
            </p>
          )}
          {mensagem && <p className="msg msg--ok">{mensagem}</p>}

          <button type="submit" className="btn btn--secondary" disabled={trocando}>
            Trocar senha
          </button>
        </form>
      </section>

      <button type="button" className="btn btn--secondary btn--block" onClick={lock}>
        Bloquear cofre
      </button>

      <ConfirmDialog
        open={arquivoParaRestaurar !== null}
        title="Restaurar backup"
        message="Isso substitui todas as pessoas e credenciais guardadas neste aparelho pelas do arquivo escolhido. Essa ação não pode ser desfeita. Depois de restaurar, você vai precisar desbloquear com a senha de quando esse backup foi feito. Tem certeza?"
        onConfirm={() => {
          void handleConfirmRestore();
        }}
        onCancel={handleCancelRestore}
      />
      {restaurando && (
        <p role="status" className="msg msg--ok">
          Restaurando...
        </p>
      )}
    </div>
  );
}
