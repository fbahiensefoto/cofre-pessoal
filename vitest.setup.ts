import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/preact';

// Sob `@vitest-environment jsdom`, o ambiente sobrescreve `globalThis.Uint8Array` pelo
// construtor do realm próprio do jsdom, mas `TextEncoder` continua produzindo instâncias
// do realm original do Node — então `algumUint8Array instanceof Uint8Array` dá `false`
// dentro de um teste jsdom. Isso quebra as checagens internas do libsodium (que usam
// exatamente esse `instanceof`) sempre que criptografamos algo derivado de
// `new TextEncoder().encode(...)`. Realinha os dois para o mesmo realm. Em ambiente
// `node` (padrão deste projeto) isso é um no-op inofensivo: `Uint8Array` já É o que
// `TextEncoder` produz.
globalThis.Uint8Array = new TextEncoder().encode().constructor as typeof Uint8Array;

afterEach(cleanup);
