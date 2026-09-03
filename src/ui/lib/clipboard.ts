/**
 * `navigator.clipboard` (a API moderna) também exige contexto seguro — o
 * mesmo motivo pelo qual `crypto.randomUUID` falhava em `http://<ip-da-rede-
 * local>`. Aqui o fallback é o `document.execCommand('copy')` legado (via
 * um textarea temporário fora da tela): não depende de contexto seguro,
 * ainda funciona em todo navegador atual mesmo "descontinuado".
 */
export async function copyToClipboard(texto: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // cai para o método legado abaixo
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, texto.length);

  let sucesso = false;
  try {
    sucesso = document.execCommand('copy');
  } catch {
    sucesso = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return sucesso;
}
