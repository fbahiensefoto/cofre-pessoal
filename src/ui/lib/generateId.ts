/**
 * `crypto.randomUUID()` só existe em contexto seguro (HTTPS, ou "localhost"
 * literal) — o Safari não expõe a função em `http://<ip-da-rede-local>`, o
 * endereço usado pra testar o app noutro aparelho antes de instalar. Os ids
 * gerados aqui não são segredo (não protegem nada, só identificam registros),
 * então não precisam da API restrita: caem para `crypto.getRandomValues`
 * (mais amplamente disponível) e, na ausência dela, para `Math.random`.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Marca de versão/variante UUID v4, como o crypto.randomUUID nativo produz.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
