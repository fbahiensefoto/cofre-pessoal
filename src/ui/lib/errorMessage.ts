/** Extrai uma descrição curta e diagnosticável de um erro capturado. */
export function detalheDoErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.name ? `${erro.name}: ${erro.message}` : erro.message;
  }
  return String(erro);
}
