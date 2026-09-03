import sodium from 'libsodium-wrappers-sumo';

export type Sodium = typeof sodium;

/**
 * Inicializa o libsodium (variante "sumo", necessária para Argon2id).
 * Deve ser chamado uma única vez; a instância pode ser injetada nos
 * demais componentes.
 */
export async function initSodium(): Promise<Sodium> {
  await sodium.ready;
  return sodium;
}
