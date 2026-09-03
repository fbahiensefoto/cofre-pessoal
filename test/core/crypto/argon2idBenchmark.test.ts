import { describe, expect, it } from 'vitest';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams, KeyDerivation } from '../../../src/core/crypto/keyDerivation';

describe('Argon2id benchmark', () => {
  it('mede o tempo do Argon2id (preset INTERACTIVE) no host de desenvolvimento', async () => {
    const sodium = await initSodium();
    const kdf = new KeyDerivation(sodium);
    const salt = kdf.generateSalt();
    const params = interactiveParams(sodium);

    const inicio = performance.now();
    const key = kdf.deriveKey('frase-senha-ficticia-de-teste', salt, params, 32);
    const duracaoMs = performance.now() - inicio;

    expect(key.length).toBe(32);

    // Medição só de referência do host de desenvolvimento — não representa um
    // iPhone real. O valor impresso aqui deve ser copiado manualmente para
    // docs/fase1-entrega.md, com a ressalva de que precisa revalidação no
    // Safari do iPhone real antes de qualquer uso além de teste. Argon2id em
    // WASM tende a ser mais lento que uma implementação nativa.
    console.log(
      `Argon2id INTERACTIVE (mem=${params.memLimit}B, ops=${params.opsLimit}) no host: ${duracaoMs.toFixed(1)}ms`,
    );
  });
});
