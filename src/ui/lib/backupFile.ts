function nomeArquivoBackup(): string {
  const agora = new Date().toISOString().slice(0, 10);
  return `cofre-pessoal-backup-${agora}.cofre`;
}

/**
 * Entrega [bytes] pro usuário como um arquivo. `navigator.share` com
 * arquivos abre a folha de compartilhamento nativa direto (Mensagens,
 * AirDrop, etc.) — exatamente o "enviar por mensagem" pedido — mas, como
 * `crypto.randomUUID` e `navigator.clipboard`, exige contexto seguro
 * (HTTPS ou "localhost"), que este app não tem enquanto servido por
 * `http://<ip-da-rede-local>`. Sem isso disponível, cai para um link de
 * download: no Safari do iPhone isso normalmente abre uma pré-visualização
 * com seu próprio botão de compartilhar — funciona, só com um toque a mais.
 */
export async function shareOrDownloadBackup(bytes: Uint8Array): Promise<'compartilhado' | 'baixado'> {
  const nomeArquivo = nomeArquivoBackup();
  // Uint8Array<ArrayBufferLike> vs. o BlobPart que a lib do DOM espera
  // (ArrayBufferView<ArrayBuffer>, sem SharedArrayBuffer) é só uma
  // discrepância de tipos — os bytes aqui nunca vêm de um
  // SharedArrayBuffer nesta base de código.
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([blob], nomeArquivo, { type: 'application/octet-stream' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'compartilhado';
      } catch (erro) {
        // Usuário cancelou a folha de compartilhamento (AbortError) não é
        // uma falha — só significa que ele desistiu. Qualquer outro erro
        // cai pro link de download abaixo.
        if (erro instanceof Error && erro.name === 'AbortError') {
          return 'compartilhado';
        }
      }
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Adia a revogação: em alguns navegadores, revogar a URL imediatamente
    // após o clique cancela o download antes dele começar de verdade.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return 'baixado';
}

export async function readFileAsBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}
