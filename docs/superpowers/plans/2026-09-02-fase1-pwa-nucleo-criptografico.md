# Fase 1 (PWA) — Núcleo Criptográfico e Formato do Cofre — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir e testar, sem nenhuma tela ainda, o núcleo que protege os dados do Cofre Pessoal rodando no navegador — derivação de chave via Argon2id, envelope encryption da chave do cofre, criptografia autenticada dos dados via XChaCha20-Poly1305, formato de arquivo versionado, gravação atômica no IndexedDB.

**Architecture:** Módulos TypeScript puros (`src/core/crypto`, `src/core/vault`, `src/core/model`), sem dependência de UI, testáveis via Vitest no Node (com `fake-indexeddb` simulando o IndexedDB do navegador). `VaultKeyManager` implementa o envelope encryption; `VaultHeader`/`VaultFile` definem a serialização binária; `VaultStorage` grava no IndexedDB; `VaultRepository` orquestra tudo numa API de alto nível.

**Tech Stack:** TypeScript + Vite + Vitest, `libsodium-wrappers-sumo` (bindings WASM do libsodium) para Argon2id e XChaCha20-Poly1305, `fake-indexeddb` só em teste.

Referências: [docs/briefing-cofre-pessoal.md](../../briefing-cofre-pessoal.md), [docs/superpowers/specs/2026-09-02-fase1-pwa-nucleo-criptografico-design.md](../specs/2026-09-02-fase1-pwa-nucleo-criptografico-design.md).

## Global Constraints

- Dependência de cripto: `libsodium-wrappers-sumo` (versão atual confirmada: `^0.8.4`). A variante "sumo" é obrigatória — `crypto_pwhash` (Argon2id) não existe na variante padrão `libsodium-wrappers`.
- Node.js já está instalado nesta máquina (`v24.18.0`) — não é preciso instalar nada de novo para esta fase.
- Algoritmo do Argon2id sempre explícito: `sodium.crypto_pwhash_ALG_ARGON2ID13` — nunca confiar em um "default" implícito.
- Mensagens de erro em português, nunca incluindo senha, chave ou conteúdo decifrado.
- Sempre que uma chave efêmera (KEK) ou a DEK deixar de ser necessária, chamar `sodium.memzero(buffer)` nela — mitigação equivalente ao `SecureKey.dispose()` que a versão Flutter usava (aqui não existe memória protegida nativa, só essa zeragem manual best-effort).
- Formato binário do cofre (v1) exatamente como especificado no design: `magic(4) + formatVersion(2) + kdfMemLimit(4) + kdfOpsLimit(4) + salt(16) + wrapNonce(24) + wrapCiphertext(48) + dataNonce(24) + dataLength(4) + dataCiphertext(N)`, inteiros multi-byte em big-endian (`DataView`, `littleEndian = false`).
- Sem chamada de rede em nenhum código deste pacote.
- Critério de conclusão da fase: todos os testes passando via `npx vitest run`, `npx tsc --noEmit` sem erros, relatório de entrega em `docs/fase1-entrega.md` com os tempos medidos do Argon2id.

---

### Task 1: Scaffold do projeto TypeScript e inicialização do sodium

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/core/crypto/sodiumProvider.ts`
- Create: `test/core/crypto/sodiumProvider.test.ts`
- Create: `.gitignore` (Node/TypeScript — substitui o `.gitignore` provisório atual)

**Interfaces:**
- Produces: `export type Sodium = /* tipo da instância inicializada */` e `export async function initSodium(): Promise<Sodium>` — usado por toda tarefa seguinte que precisa de uma instância inicializada do sodium.

- [ ] **Step 1: Inicializar o projeto Node**

Run: `npm init -y`

Editar o `package.json` gerado para o conteúdo abaixo (mantém o que `npm init` já colocou de nome/versão, ajusta o resto):

```json
{
  "name": "cofre-pessoal",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "libsodium-wrappers-sumo": "^0.8.4"
  },
  "devDependencies": {
    "@types/libsodium-wrappers-sumo": "^0.8.2",
    "fake-indexeddb": "^6.2.5",
    "typescript": "^7.0.2",
    "vitest": "^4.1.11"
  }
}
```

Run: `npm install`
Esperado: resolve sem erro.

- [ ] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

(`"lib": ["ES2022", "DOM"]` inclui os tipos de `indexedDB`/`IDBDatabase` mesmo rodando os testes no Node, porque o código de produção em `src/core/vault/vaultStorage.ts` vai usar a API de IndexedDB do navegador diretamente — em teste, `fake-indexeddb` implementa essa mesma API global.)

- [ ] **Step 3: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Criar o `.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 5: Escrever o teste que falha**

Criar `test/core/crypto/sodiumProvider.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';

describe('initSodium', () => {
  it('inicializa o sodium e expõe as constantes do AEAD XChaCha20-Poly1305', async () => {
    const sodium = await initSodium();

    expect(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES).toBe(32);
    expect(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES).toBe(24);
    expect(sodium.crypto_pwhash_SALTBYTES).toBe(16);
  });
});
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `npx vitest run test/core/crypto/sodiumProvider.test.ts`
Esperado: FAIL — `src/core/crypto/sodiumProvider.ts` não existe.

- [ ] **Step 7: Implementar `sodiumProvider.ts`**

Criar `src/core/crypto/sodiumProvider.ts`:

```typescript
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
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npx vitest run test/core/crypto/sodiumProvider.test.ts`
Esperado: PASS.

- [ ] **Step 9: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src test
git commit -m "$(cat <<'EOF'
Scaffold TypeScript project and wire up sodium initialization

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: KeyDerivation (Argon2id)

**Files:**
- Create: `src/core/crypto/keyDerivation.ts`
- Test: `test/core/crypto/keyDerivation.test.ts`

**Interfaces:**
- Consumes: `Sodium`, `initSodium()` (Task 1).
- Produces: `export interface Argon2Params { opsLimit: number; memLimit: number }`; `export function interactiveParams(sodium: Sodium): Argon2Params`; `export class KeyDerivation` com `constructor(sodium: Sodium)`, `get saltBytes(): number`, `generateSalt(): Uint8Array`, `deriveKey(password: string, salt: Uint8Array, params: Argon2Params, outLen: number): Uint8Array`. Usado pelas Tasks 6, 9.

- [ ] **Step 1: Escrever o teste do vetor conhecido do libsodium**

Este vetor vem da suíte de testes oficial do libsodium (`test/default/pwhash_argon2id.c`, tag `1.0.22-RELEASE`, caso de teste índice 6 — o mais rápido dos oito, `opslimit` no mínimo absoluto permitido). **Verificado empiricamente nesta máquina**, rodando `sodium.crypto_pwhash` de verdade com esses valores exatos e conferindo a saída — não é um valor copiado sem checar.

Criar `test/core/crypto/keyDerivation.test.ts`:

```typescript
import { beforeAll, describe, expect, it } from 'vitest';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams, KeyDerivation } from '../../../src/core/crypto/keyDerivation';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('KeyDerivation', () => {
  let sodium: Sodium;

  beforeAll(async () => {
    sodium = await initSodium();
  });

  it('bate com o vetor conhecido do libsodium (crypto_pwhash, Argon2id13, opslimit mínimo)', () => {
    const password = hexToBytes(
      'b540beb016a5366524d4605156493f9874514a5aa58818cd0c6dfffaa9e90205f17b',
    );
    const salt = hexToBytes('44071f6d181561670bda728d43fb79b4');
    const expectedHex =
      '7fb72409b0987f8190c3729710e98c3f80c5a8727d425fdcde7f3644d467fe973f5b5fee' +
      '683bd3fce812cb9ae5e9921a2d06c2f1905e4e839692f2b934b682f11a2fe2b90482ea5dd' +
      '234863516dba6f52dc0702d324ec77d860c2e181f84472bd7104fedce071ffa93c530949' +
      '4ad51623d214447a7b2b1462dc7d5d55a1f6fd5b54ce024118d86f0c6489d16545aaa87b' +
      '6689dad9f2fb47fda9894f8e12b87d978b483ccd4cc5fd9595cdc7a818452f915ce2f7d' +
      'f95ec12b1c72e3788d473441d884f9748eb14703c21b45d82fd667b85f5b2d98c13303b' +
      '3fe76285531a826b6fc0fe8e3dddecf';

    const derived = sodium.crypto_pwhash(
      231,
      password,
      salt,
      1,
      1631659,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );

    expect(bytesToHex(derived)).toBe(expectedHex);
  });

  it('KeyDerivation.deriveKey é determinística para as mesmas entradas', () => {
    const kdf = new KeyDerivation(sodium);
    const salt = kdf.generateSalt();
    const params = interactiveParams(sodium);

    const key1 = kdf.deriveKey('frase-senha-fictícia', salt, params, 32);
    const key2 = kdf.deriveKey('frase-senha-fictícia', salt, params, 32);

    expect(key1).toEqual(key2);
  });

  it('KeyDerivation.deriveKey produz saída diferente para salts diferentes', () => {
    const kdf = new KeyDerivation(sodium);
    const params = interactiveParams(sodium);

    const key1 = kdf.deriveKey('frase-senha-fictícia', kdf.generateSalt(), params, 32);
    const key2 = kdf.deriveKey('frase-senha-fictícia', kdf.generateSalt(), params, 32);

    expect(key1).not.toEqual(key2);
  });

  it('KeyDerivation.generateSalt gera valores de tamanho correto e distintos', () => {
    const kdf = new KeyDerivation(sodium);
    const salt1 = kdf.generateSalt();
    const salt2 = kdf.generateSalt();

    expect(salt1.length).toBe(kdf.saltBytes);
    expect(salt1).not.toEqual(salt2);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run test/core/crypto/keyDerivation.test.ts`
Esperado: FAIL — `src/core/crypto/keyDerivation.ts` não existe.

- [ ] **Step 3: Implementar `keyDerivation.ts`**

Criar `src/core/crypto/keyDerivation.ts`:

```typescript
import type { Sodium } from './sodiumProvider';

export interface Argon2Params {
  opsLimit: number;
  memLimit: number;
}

/**
 * Preset conservador (64 MiB / 2 iterações) usado como baseline provisório
 * nesta fase. Precisa ser revalidado com benchmark no Safari do iPhone real
 * antes de qualquer uso além de testes — ver docs/fase1-entrega.md.
 */
export function interactiveParams(sodium: Sodium): Argon2Params {
  return {
    opsLimit: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memLimit: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  };
}

export class KeyDerivation {
  constructor(private readonly sodium: Sodium) {}

  get saltBytes(): number {
    return this.sodium.crypto_pwhash_SALTBYTES;
  }

  generateSalt(): Uint8Array {
    return this.sodium.randombytes_buf(this.saltBytes);
  }

  deriveKey(password: string, salt: Uint8Array, params: Argon2Params, outLen: number): Uint8Array {
    return this.sodium.crypto_pwhash(
      outLen,
      password,
      salt,
      params.opsLimit,
      params.memLimit,
      this.sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run test/core/crypto/keyDerivation.test.ts`
Esperado: PASS (4 testes).

- [ ] **Step 5: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/crypto/keyDerivation.ts test/core/crypto/keyDerivation.test.ts
git commit -m "$(cat <<'EOF'
Add Argon2id key derivation wrapper with libsodium known-answer test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: AeadCipher (XChaCha20-Poly1305)

**Files:**
- Create: `src/core/crypto/aeadCipher.ts`
- Test: `test/core/crypto/aeadCipher.test.ts`

**Interfaces:**
- Consumes: `Sodium`, `initSodium()` (Task 1).
- Produces: `export class AeadCipher` com `constructor(sodium: Sodium)`, `get keyBytes(): number`, `get nonceBytes(): number`, `generateNonce(): Uint8Array`, `encrypt(message: Uint8Array, nonce: Uint8Array, key: Uint8Array, additionalData?: Uint8Array): Uint8Array`, `decrypt(cipherText: Uint8Array, nonce: Uint8Array, key: Uint8Array, additionalData?: Uint8Array): Uint8Array`. Usado pelas Tasks 6, 9.

**Nota de implementação importante:** a ordem dos parâmetros das funções nativas do libsodium.js **não é simétrica** entre encrypt e decrypt — confirmado empiricamente nesta máquina, não é suposição:
- `sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(message, additional_data, secret_nonce, public_nonce, key)`
- `sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(secret_nonce, ciphertext, additional_data, public_nonce, key)`

`secret_nonce` é sempre `null` (não é usado por essa cifra). Chamar decrypt com os argumentos na ordem de encrypt (ou vice-versa) compila sem erro de tipo mas falha ou produz resultado errado — os testes abaixo verificam que a integração está correta.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/crypto/aeadCipher.test.ts`:

```typescript
import { beforeAll, describe, expect, it } from 'vitest';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { AeadCipher } from '../../../src/core/crypto/aeadCipher';

describe('AeadCipher', () => {
  let sodium: Sodium;
  let aead: AeadCipher;

  beforeAll(async () => {
    sodium = await initSodium();
    aead = new AeadCipher(sodium);
  });

  it('round-trip: decifrar o que foi cifrado devolve a mensagem original', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');

    const cipherText = aead.encrypt(message, nonce, key);
    const plainText = aead.decrypt(cipherText, nonce, key);

    expect(plainText).toEqual(message);
  });

  it('round-trip com dados associados (AAD) confere e detecta troca de AAD', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');
    const aad = new TextEncoder().encode('cabecalho-v1');
    const aadTrocado = new TextEncoder().encode('cabecalho-v2');

    const cipherText = aead.encrypt(message, nonce, key, aad);
    const plainText = aead.decrypt(cipherText, nonce, key, aad);
    expect(plainText).toEqual(message);

    expect(() => aead.decrypt(cipherText, nonce, key, aadTrocado)).toThrow();
  });

  it('adulterar um byte do ciphertext faz a decifração falhar', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');

    const cipherText = aead.encrypt(message, nonce, key);
    const adulterado = new Uint8Array(cipherText);
    adulterado[0] ^= 0xff;

    expect(() => aead.decrypt(adulterado, nonce, key)).toThrow();
  });

  it('decifrar com o nonce errado falha', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const outroNonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');

    const cipherText = aead.encrypt(message, nonce, key);

    expect(() => aead.decrypt(cipherText, outroNonce, key)).toThrow();
  });

  it('decifrar com a chave errada falha', () => {
    const key = sodium.randombytes_buf(aead.keyBytes);
    const outraKey = sodium.randombytes_buf(aead.keyBytes);
    const nonce = aead.generateNonce();
    const message = new TextEncoder().encode('credencial fictícia de teste');

    const cipherText = aead.encrypt(message, nonce, key);

    expect(() => aead.decrypt(cipherText, nonce, outraKey)).toThrow();
  });

  it('unicidade estatística dos nonces gerados', () => {
    const nonces = Array.from({ length: 1000 }, () => aead.generateNonce());
    const unicos = new Set(nonces.map((n) => Buffer.from(n).toString('base64')));
    expect(unicos.size).toBe(nonces.length);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run test/core/crypto/aeadCipher.test.ts`
Esperado: FAIL — `src/core/crypto/aeadCipher.ts` não existe.

- [ ] **Step 3: Implementar `aeadCipher.ts`**

Criar `src/core/crypto/aeadCipher.ts`:

```typescript
import type { Sodium } from './sodiumProvider';

export class AeadCipher {
  constructor(private readonly sodium: Sodium) {}

  get keyBytes(): number {
    return this.sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES;
  }

  get nonceBytes(): number {
    return this.sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  }

  generateNonce(): Uint8Array {
    return this.sodium.randombytes_buf(this.nonceBytes);
  }

  encrypt(message: Uint8Array, nonce: Uint8Array, key: Uint8Array, additionalData?: Uint8Array): Uint8Array {
    return this.sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      message,
      additionalData ?? null,
      null,
      nonce,
      key,
    );
  }

  decrypt(cipherText: Uint8Array, nonce: Uint8Array, key: Uint8Array, additionalData?: Uint8Array): Uint8Array {
    return this.sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      cipherText,
      additionalData ?? null,
      nonce,
      key,
    );
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run test/core/crypto/aeadCipher.test.ts`
Esperado: PASS (6 testes).

- [ ] **Step 5: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/crypto/aeadCipher.ts test/core/crypto/aeadCipher.test.ts
git commit -m "$(cat <<'EOF'
Add XChaCha20-Poly1305 AEAD wrapper with tamper and nonce-uniqueness tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Exceções de domínio e VaultHeader

**Files:**
- Create: `src/core/vault/vaultExceptions.ts`
- Create: `src/core/vault/vaultHeader.ts`
- Test: `test/core/vault/vaultHeader.test.ts`

**Interfaces:**
- Produces: `export class VaultNotFoundError extends Error`, `export class VaultUnsupportedVersionError extends Error { readonly foundVersion: number }`, `export class VaultCorruptHeaderError extends Error { readonly reason: string }`, `export class VaultAuthenticationFailedError extends Error`; `export const CURRENT_VERSION = 1`, `export const HEADER_LENGTH = 30`, `export class VaultHeader` com `constructor(formatVersion: number, kdfMemLimit: number, kdfOpsLimit: number, salt: Uint8Array)`, `toBytes(): Uint8Array`, `get dataAad(): Uint8Array`, `static fromBytes(bytes: Uint8Array): VaultHeader`. Usado pelas Tasks 6, 7, 9.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vaultHeader.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { CURRENT_VERSION, HEADER_LENGTH, VaultHeader } from '../../../src/core/vault/vaultHeader';
import { VaultCorruptHeaderError } from '../../../src/core/vault/vaultExceptions';

function sampleHeader(): VaultHeader {
  return new VaultHeader(
    CURRENT_VERSION,
    67108864,
    2,
    Uint8Array.from({ length: 16 }, (_, i) => i),
  );
}

describe('VaultHeader', () => {
  it('round-trip: fromBytes(toBytes()) preserva todos os campos', () => {
    const header = sampleHeader();
    const parsed = VaultHeader.fromBytes(header.toBytes());

    expect(parsed.formatVersion).toBe(header.formatVersion);
    expect(parsed.kdfMemLimit).toBe(header.kdfMemLimit);
    expect(parsed.kdfOpsLimit).toBe(header.kdfOpsLimit);
    expect(parsed.salt).toEqual(header.salt);
  });

  it('toBytes() produz exatamente HEADER_LENGTH bytes', () => {
    expect(sampleHeader().toBytes().length).toBe(HEADER_LENGTH);
  });

  it('dataAad contém só magic + versão (6 bytes), estável entre cabeçalhos com salts diferentes', () => {
    const header1 = sampleHeader();
    const header2 = new VaultHeader(
      CURRENT_VERSION,
      999999,
      9,
      Uint8Array.from({ length: 16 }, (_, i) => 255 - i),
    );

    expect(header1.dataAad.length).toBe(6);
    expect(header1.dataAad).toEqual(header2.dataAad);
  });

  it('fromBytes rejeita magic inválido', () => {
    const bytes = sampleHeader().toBytes();
    bytes[0] = 0x00;

    expect(() => VaultHeader.fromBytes(bytes)).toThrow(VaultCorruptHeaderError);
  });

  it('fromBytes rejeita bytes truncados', () => {
    const bytes = sampleHeader().toBytes();
    const truncado = bytes.slice(0, HEADER_LENGTH - 1);

    expect(() => VaultHeader.fromBytes(truncado)).toThrow(VaultCorruptHeaderError);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run test/core/vault/vaultHeader.test.ts`
Esperado: FAIL — os módulos não existem.

- [ ] **Step 3: Implementar `vaultExceptions.ts`**

Criar `src/core/vault/vaultExceptions.ts`:

```typescript
export class VaultNotFoundError extends Error {
  constructor() {
    super('Nenhum cofre encontrado.');
    this.name = 'VaultNotFoundError';
  }
}

export class VaultUnsupportedVersionError extends Error {
  readonly foundVersion: number;

  constructor(foundVersion: number) {
    super(`Versão de formato do cofre não suportada: ${foundVersion}.`);
    this.name = 'VaultUnsupportedVersionError';
    this.foundVersion = foundVersion;
  }
}

export class VaultCorruptHeaderError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Cabeçalho do cofre inválido: ${reason}`);
    this.name = 'VaultCorruptHeaderError';
    this.reason = reason;
  }
}

export class VaultAuthenticationFailedError extends Error {
  constructor() {
    super('Senha incorreta ou arquivo corrompido.');
    this.name = 'VaultAuthenticationFailedError';
  }
}
```

- [ ] **Step 4: Implementar `vaultHeader.ts`**

Criar `src/core/vault/vaultHeader.ts`:

```typescript
import { VaultCorruptHeaderError } from './vaultExceptions';

const MAGIC = new Uint8Array([0x43, 0x50, 0x56, 0x31]); // "CPV1"
export const CURRENT_VERSION = 1;
export const HEADER_LENGTH = 4 + 2 + 4 + 4 + 16; // 30 bytes

export class VaultHeader {
  constructor(
    public readonly formatVersion: number,
    public readonly kdfMemLimit: number,
    public readonly kdfOpsLimit: number,
    public readonly salt: Uint8Array,
  ) {}

  /** Bytes completos do cabeçalho — usados como AAD ao embrulhar a DEK. */
  toBytes(): Uint8Array {
    const result = new Uint8Array(HEADER_LENGTH);
    const view = new DataView(result.buffer);
    result.set(MAGIC, 0);
    view.setUint16(4, this.formatVersion, false);
    view.setUint32(6, this.kdfMemLimit, false);
    view.setUint32(10, this.kdfOpsLimit, false);
    result.set(this.salt, 14);
    return result;
  }

  /**
   * AAD usado para a seção de dados — deliberadamente não inclui salt/params,
   * para que trocar a senha mestra não exija recriptografar os dados.
   */
  get dataAad(): Uint8Array {
    const result = new Uint8Array(6);
    result.set(MAGIC, 0);
    new DataView(result.buffer).setUint16(4, this.formatVersion, false);
    return result;
  }

  static fromBytes(bytes: Uint8Array): VaultHeader {
    if (bytes.length < HEADER_LENGTH) {
      throw new VaultCorruptHeaderError('Cabeçalho truncado.');
    }
    for (let i = 0; i < MAGIC.length; i++) {
      if (bytes[i] !== MAGIC[i]) {
        throw new VaultCorruptHeaderError('Assinatura do arquivo inválida.');
      }
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_LENGTH);
    const formatVersion = view.getUint16(4, false);
    const kdfMemLimit = view.getUint32(6, false);
    const kdfOpsLimit = view.getUint32(10, false);
    const salt = bytes.slice(14, 30);

    return new VaultHeader(formatVersion, kdfMemLimit, kdfOpsLimit, salt);
  }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run test/core/vault/vaultHeader.test.ts`
Esperado: PASS (5 testes).

- [ ] **Step 6: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/core/vault/vaultExceptions.ts src/core/vault/vaultHeader.ts test/core/vault/vaultHeader.test.ts
git commit -m "$(cat <<'EOF'
Add vault domain errors and versioned header serialization

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Modelo Credential

**Files:**
- Create: `src/core/model/credential.ts`
- Test: `test/core/model/credential.test.ts`

**Interfaces:**
- Produces: `export interface Credential { id: string; serviceName: string; category: string; url?: string; username?: string; password: string; notes?: string; tags: string[]; favorite: boolean; createdAt: string; updatedAt: string }`. Usado pela Task 9.

- [ ] **Step 1: Escrever o teste**

Criar `test/core/model/credential.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { Credential } from '../../../src/core/model/credential';

describe('Credential', () => {
  it('round-trip: JSON.parse(JSON.stringify()) preserva todos os campos', () => {
    const original: Credential = {
      id: 'id-ficticio-001',
      serviceName: 'Serviço Fictício',
      category: 'e-mail',
      url: 'https://exemplo.invalido',
      username: 'usuario.ficticio@exemplo.invalido',
      password: 'senha-ficticia-de-teste',
      notes: 'observação de teste',
      tags: ['pessoal', 'teste'],
      favorite: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    const restored = JSON.parse(JSON.stringify(original)) as Credential;

    expect(restored).toEqual(original);
  });

  it('campos opcionais podem ser omitidos', () => {
    const credential: Credential = {
      id: 'id-ficticio-002',
      serviceName: 'Outro Serviço Fictício',
      category: 'site',
      password: 'outra-senha-ficticia',
      tags: [],
      favorite: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(credential.url).toBeUndefined();
    expect(credential.username).toBeUndefined();
    expect(credential.notes).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run test/core/model/credential.test.ts`
Esperado: FAIL — `src/core/model/credential.ts` não existe.

- [ ] **Step 3: Implementar `credential.ts`**

Criar `src/core/model/credential.ts`:

```typescript
export interface Credential {
  id: string;
  serviceName: string;
  category: string;
  url?: string;
  username?: string;
  password: string;
  notes?: string;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run test/core/model/credential.test.ts`
Esperado: PASS (2 testes).

- [ ] **Step 5: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/model/credential.ts test/core/model/credential.test.ts
git commit -m "$(cat <<'EOF'
Add Credential domain model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: VaultKeyManager (envelope encryption da DEK)

**Files:**
- Create: `src/core/vault/vaultKeyManager.ts`
- Test: `test/core/vault/vaultKeyManager.test.ts`

**Interfaces:**
- Consumes: `KeyDerivation`, `Argon2Params`, `interactiveParams` (Task 2); `AeadCipher` (Task 3); `VaultHeader`, `CURRENT_VERSION`, `VaultAuthenticationFailedError` (Task 4).
- Produces: `export interface WrappedDek { nonce: Uint8Array; ciphertext: Uint8Array }`; `export interface WrapResult { header: VaultHeader; wrapped: WrappedDek }`; `export class VaultKeyManager` com `constructor(sodium: Sodium)`, `generateDek(): Uint8Array`, `wrapNewDek(dek: Uint8Array, masterPassword: string, params: Argon2Params): WrapResult`, `unwrapDek(header: VaultHeader, wrapped: WrappedDek, masterPassword: string): Uint8Array`, `rewrapDek(dek: Uint8Array, newMasterPassword: string, params: Argon2Params): WrapResult`. Usado pela Task 9.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vaultKeyManager.test.ts`:

```typescript
import { beforeAll, describe, expect, it } from 'vitest';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams, type Argon2Params } from '../../../src/core/crypto/keyDerivation';
import { VaultKeyManager } from '../../../src/core/vault/vaultKeyManager';
import { VaultAuthenticationFailedError } from '../../../src/core/vault/vaultExceptions';
import { VaultHeader } from '../../../src/core/vault/vaultHeader';

describe('VaultKeyManager', () => {
  let sodium: Sodium;
  let keyManager: VaultKeyManager;
  let params: Argon2Params;

  beforeAll(async () => {
    sodium = await initSodium();
    keyManager = new VaultKeyManager(sodium);
    params = interactiveParams(sodium);
  });

  it('wrapNewDek + unwrapDek com a senha correta devolve a mesma DEK', () => {
    const dek = keyManager.generateDek();

    const { header, wrapped } = keyManager.wrapNewDek(dek, 'frase-senha-ficticia-forte', params);
    const dekDesembrulhada = keyManager.unwrapDek(header, wrapped, 'frase-senha-ficticia-forte');

    expect(dekDesembrulhada).toEqual(dek);
  });

  it('unwrapDek com a senha errada lança VaultAuthenticationFailedError', () => {
    const dek = keyManager.generateDek();
    const { header, wrapped } = keyManager.wrapNewDek(dek, 'senha-correta-ficticia', params);

    expect(() => keyManager.unwrapDek(header, wrapped, 'senha-errada-ficticia')).toThrow(
      VaultAuthenticationFailedError,
    );
  });

  it('adulterar o salt do cabeçalho invalida a chave embrulhada (bloqueia downgrade)', () => {
    const dek = keyManager.generateDek();
    const { header, wrapped } = keyManager.wrapNewDek(dek, 'senha-correta-ficticia', params);

    const saltAdulterado = header.salt.slice();
    saltAdulterado[0] ^= 0xff;
    const headerAdulterado = new VaultHeader(
      header.formatVersion,
      header.kdfMemLimit,
      header.kdfOpsLimit,
      saltAdulterado,
    );

    expect(() => keyManager.unwrapDek(headerAdulterado, wrapped, 'senha-correta-ficticia')).toThrow(
      VaultAuthenticationFailedError,
    );
  });

  it('rewrapDek com nova senha invalida a senha antiga e a nova funciona', () => {
    const dek = keyManager.generateDek();
    keyManager.wrapNewDek(dek, 'senha-antiga-ficticia', params);

    const { header: header2, wrapped: wrapped2 } = keyManager.rewrapDek(dek, 'senha-nova-ficticia', params);

    expect(() => keyManager.unwrapDek(header2, wrapped2, 'senha-antiga-ficticia')).toThrow(
      VaultAuthenticationFailedError,
    );

    const dekReaberta = keyManager.unwrapDek(header2, wrapped2, 'senha-nova-ficticia');
    expect(dekReaberta).toEqual(dek);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run test/core/vault/vaultKeyManager.test.ts`
Esperado: FAIL — `src/core/vault/vaultKeyManager.ts` não existe.

- [ ] **Step 3: Implementar `vaultKeyManager.ts`**

Criar `src/core/vault/vaultKeyManager.ts`:

```typescript
import type { Sodium } from '../crypto/sodiumProvider';
import { AeadCipher } from '../crypto/aeadCipher';
import { KeyDerivation, type Argon2Params } from '../crypto/keyDerivation';
import { VaultAuthenticationFailedError } from './vaultExceptions';
import { CURRENT_VERSION, VaultHeader } from './vaultHeader';

export interface WrappedDek {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface WrapResult {
  header: VaultHeader;
  wrapped: WrappedDek;
}

export class VaultKeyManager {
  private readonly keyDerivation: KeyDerivation;
  private readonly aead: AeadCipher;

  constructor(private readonly sodium: Sodium) {
    this.keyDerivation = new KeyDerivation(sodium);
    this.aead = new AeadCipher(sodium);
  }

  generateDek(): Uint8Array {
    return this.sodium.randombytes_buf(this.aead.keyBytes);
  }

  wrapNewDek(dek: Uint8Array, masterPassword: string, params: Argon2Params): WrapResult {
    const salt = this.keyDerivation.generateSalt();
    const header = new VaultHeader(CURRENT_VERSION, params.memLimit, params.opsLimit, salt);
    const kek = this.keyDerivation.deriveKey(masterPassword, salt, params, this.aead.keyBytes);
    try {
      const nonce = this.aead.generateNonce();
      const ciphertext = this.aead.encrypt(dek, nonce, kek, header.toBytes());
      return { header, wrapped: { nonce, ciphertext } };
    } finally {
      this.sodium.memzero(kek);
    }
  }

  unwrapDek(header: VaultHeader, wrapped: WrappedDek, masterPassword: string): Uint8Array {
    const params: Argon2Params = { opsLimit: header.kdfOpsLimit, memLimit: header.kdfMemLimit };
    const kek = this.keyDerivation.deriveKey(masterPassword, header.salt, params, this.aead.keyBytes);
    try {
      return this.aead.decrypt(wrapped.ciphertext, wrapped.nonce, kek, header.toBytes());
    } catch {
      throw new VaultAuthenticationFailedError();
    } finally {
      this.sodium.memzero(kek);
    }
  }

  rewrapDek(dek: Uint8Array, newMasterPassword: string, params: Argon2Params): WrapResult {
    return this.wrapNewDek(dek, newMasterPassword, params);
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run test/core/vault/vaultKeyManager.test.ts`
Esperado: PASS (4 testes).

- [ ] **Step 5: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/vault/vaultKeyManager.ts test/core/vault/vaultKeyManager.test.ts
git commit -m "$(cat <<'EOF'
Add VaultKeyManager implementing DEK envelope encryption and rewrap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: VaultFile (serialização binária completa do arquivo)

**Files:**
- Create: `src/core/vault/vaultFormat.ts`
- Test: `test/core/vault/vaultFormat.test.ts`

**Interfaces:**
- Consumes: `VaultHeader`, `HEADER_LENGTH` (Task 4); `WrappedDek` (Task 6).
- Produces: `export class VaultFile` com `constructor(header: VaultHeader, wrappedDek: WrappedDek, dataNonce: Uint8Array, dataCiphertext: Uint8Array)`, `toBytes(): Uint8Array`, `static fromBytes(bytes: Uint8Array): VaultFile`. Usado pela Task 9.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vaultFormat.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { VaultFile } from '../../../src/core/vault/vaultFormat';
import { CURRENT_VERSION, HEADER_LENGTH, VaultHeader } from '../../../src/core/vault/vaultHeader';
import { VaultCorruptHeaderError } from '../../../src/core/vault/vaultExceptions';

function sampleFile(): VaultFile {
  return new VaultFile(
    new VaultHeader(CURRENT_VERSION, 67108864, 2, Uint8Array.from({ length: 16 }, (_, i) => i)),
    {
      nonce: Uint8Array.from({ length: 24 }, (_, i) => i),
      ciphertext: Uint8Array.from({ length: 48 }, (_, i) => 255 - i),
    },
    Uint8Array.from({ length: 24 }, (_, i) => 24 - i),
    Uint8Array.from({ length: 100 }, (_, i) => i % 256),
  );
}

describe('VaultFile', () => {
  it('round-trip: fromBytes(toBytes()) preserva todas as seções', () => {
    const file = sampleFile();
    const parsed = VaultFile.fromBytes(file.toBytes());

    expect(parsed.header.formatVersion).toBe(file.header.formatVersion);
    expect(parsed.header.kdfMemLimit).toBe(file.header.kdfMemLimit);
    expect(parsed.header.kdfOpsLimit).toBe(file.header.kdfOpsLimit);
    expect(parsed.header.salt).toEqual(file.header.salt);
    expect(parsed.wrappedDek.nonce).toEqual(file.wrappedDek.nonce);
    expect(parsed.wrappedDek.ciphertext).toEqual(file.wrappedDek.ciphertext);
    expect(parsed.dataNonce).toEqual(file.dataNonce);
    expect(parsed.dataCiphertext).toEqual(file.dataCiphertext);
  });

  it('funciona com dataCiphertext vazio (cofre recém-criado, sem credenciais)', () => {
    const base = sampleFile();
    const file = new VaultFile(base.header, base.wrappedDek, base.dataNonce, new Uint8Array(0));
    const parsed = VaultFile.fromBytes(file.toBytes());

    expect(parsed.dataCiphertext.length).toBe(0);
  });

  it('fromBytes rejeita arquivo truncado na seção de chave', () => {
    const bytes = sampleFile().toBytes();
    const truncado = bytes.slice(0, HEADER_LENGTH + 10);

    expect(() => VaultFile.fromBytes(truncado)).toThrow(VaultCorruptHeaderError);
  });

  it('fromBytes rejeita arquivo truncado na seção de dados', () => {
    const bytes = sampleFile().toBytes();
    const truncado = bytes.slice(0, bytes.length - 10);

    expect(() => VaultFile.fromBytes(truncado)).toThrow(VaultCorruptHeaderError);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run test/core/vault/vaultFormat.test.ts`
Esperado: FAIL — `src/core/vault/vaultFormat.ts` não existe.

- [ ] **Step 3: Implementar `vaultFormat.ts`**

Criar `src/core/vault/vaultFormat.ts`:

```typescript
import { VaultCorruptHeaderError } from './vaultExceptions';
import { HEADER_LENGTH, VaultHeader } from './vaultHeader';
import type { WrappedDek } from './vaultKeyManager';

const WRAP_NONCE_LENGTH = 24; // crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
const WRAP_CIPHERTEXT_LENGTH = 48; // DEK (32B) + tag Poly1305 (16B)
const DATA_NONCE_LENGTH = 24;
const DATA_LENGTH_FIELD_SIZE = 4;

export class VaultFile {
  constructor(
    public readonly header: VaultHeader,
    public readonly wrappedDek: WrappedDek,
    public readonly dataNonce: Uint8Array,
    public readonly dataCiphertext: Uint8Array,
  ) {}

  toBytes(): Uint8Array {
    const headerBytes = this.header.toBytes();
    const dataLengthBytes = new Uint8Array(DATA_LENGTH_FIELD_SIZE);
    new DataView(dataLengthBytes.buffer).setUint32(0, this.dataCiphertext.length, false);

    const result = new Uint8Array(
      headerBytes.length +
        WRAP_NONCE_LENGTH +
        WRAP_CIPHERTEXT_LENGTH +
        DATA_NONCE_LENGTH +
        DATA_LENGTH_FIELD_SIZE +
        this.dataCiphertext.length,
    );

    let offset = 0;
    result.set(headerBytes, offset);
    offset += headerBytes.length;
    result.set(this.wrappedDek.nonce, offset);
    offset += WRAP_NONCE_LENGTH;
    result.set(this.wrappedDek.ciphertext, offset);
    offset += WRAP_CIPHERTEXT_LENGTH;
    result.set(this.dataNonce, offset);
    offset += DATA_NONCE_LENGTH;
    result.set(dataLengthBytes, offset);
    offset += DATA_LENGTH_FIELD_SIZE;
    result.set(this.dataCiphertext, offset);

    return result;
  }

  static fromBytes(bytes: Uint8Array): VaultFile {
    let offset = HEADER_LENGTH;
    if (bytes.length < offset) {
      throw new VaultCorruptHeaderError('Cabeçalho truncado.');
    }
    const header = VaultHeader.fromBytes(bytes.slice(0, offset));

    if (bytes.length < offset + WRAP_NONCE_LENGTH + WRAP_CIPHERTEXT_LENGTH) {
      throw new VaultCorruptHeaderError('Seção de chave embrulhada truncada.');
    }
    const wrapNonce = bytes.slice(offset, offset + WRAP_NONCE_LENGTH);
    offset += WRAP_NONCE_LENGTH;
    const wrapCiphertext = bytes.slice(offset, offset + WRAP_CIPHERTEXT_LENGTH);
    offset += WRAP_CIPHERTEXT_LENGTH;

    if (bytes.length < offset + DATA_NONCE_LENGTH + DATA_LENGTH_FIELD_SIZE) {
      throw new VaultCorruptHeaderError('Seção de dados truncada.');
    }
    const dataNonce = bytes.slice(offset, offset + DATA_NONCE_LENGTH);
    offset += DATA_NONCE_LENGTH;
    const dataLengthView = new DataView(bytes.buffer, bytes.byteOffset + offset, DATA_LENGTH_FIELD_SIZE);
    const dataLength = dataLengthView.getUint32(0, false);
    offset += DATA_LENGTH_FIELD_SIZE;

    if (bytes.length < offset + dataLength) {
      throw new VaultCorruptHeaderError('Ciphertext de dados truncado.');
    }
    const dataCiphertext = bytes.slice(offset, offset + dataLength);

    return new VaultFile(header, { nonce: wrapNonce, ciphertext: wrapCiphertext }, dataNonce, dataCiphertext);
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run test/core/vault/vaultFormat.test.ts`
Esperado: PASS (4 testes).

- [ ] **Step 5: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/vault/vaultFormat.ts test/core/vault/vaultFormat.test.ts
git commit -m "$(cat <<'EOF'
Add binary serialization for the versioned vault file format

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: VaultStorage (IndexedDB)

**Files:**
- Create: `src/core/vault/vaultStorage.ts`
- Test: `test/core/vault/vaultStorage.test.ts`

**Interfaces:**
- Produces: `export class VaultStorage` com `exists(): Promise<boolean>`, `readBytes(): Promise<Uint8Array>`, `writeAtomic(bytes: Uint8Array): Promise<void>`. Usado pela Task 9.

**Nota de design:** ao contrário da versão Flutter (que precisava do padrão `.tmp` + rename para gravação atômica em arquivo), o IndexedDB já garante atomicidade de transação nativamente — uma transação `readwrite` só é visível depois de commitar por completo. Não existe cenário de "gravação interrompida deixa lixo" aqui: se a aba fechar no meio de uma transação, ela simplesmente nunca commita e o registro anterior permanece intacto. Por isso não há um método `cleanupOrphanedTmp()` equivalente ao da versão Flutter — verificado empiricamente com `fake-indexeddb` nesta máquina.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vaultStorage.test.ts`. Este arquivo precisa do `fake-indexeddb` instalado globalmente antes de qualquer outra coisa rodar — a primeira linha do arquivo importa `fake-indexeddb/auto`, que registra `indexedDB` como global (verificado empiricamente nesta máquina antes de escrever este plano).

```typescript
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';

function randomBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
}

describe('VaultStorage', () => {
  let storage: VaultStorage;

  beforeEach(() => {
    storage = new VaultStorage();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('exists() é falso antes de qualquer gravação e verdadeiro depois', async () => {
    expect(await storage.exists()).toBe(false);

    await storage.writeAtomic(new Uint8Array([1, 2, 3]));

    expect(await storage.exists()).toBe(true);
  });

  it('writeAtomic seguido de readBytes devolve exatamente os mesmos bytes', async () => {
    const conteudo = randomBytes(500);

    await storage.writeAtomic(conteudo);
    const lido = await storage.readBytes();

    expect(lido).toEqual(conteudo);
  });

  it('writeAtomic sobrescreve completamente o registro anterior', async () => {
    await storage.writeAtomic(new Uint8Array([1, 1, 1]));
    await storage.writeAtomic(new Uint8Array([2, 2, 2, 2]));

    const lido = await storage.readBytes();

    expect(lido).toEqual(new Uint8Array([2, 2, 2, 2]));
  });

  it('readBytes sem cofre existente rejeita a promise', async () => {
    await expect(storage.readBytes()).rejects.toThrow();
  });

  it('uma transação que não commita não altera o registro anterior', async () => {
    await storage.writeAtomic(new Uint8Array([9, 9, 9]));

    // Simula uma "gravação interrompida": abre a mesma transação de baixo
    // nível que writeAtomic usaria, grava um valor novo, mas aborta em vez
    // de deixar commitar — equivalente a app fechado/exceção no meio da
    // gravação, sem precisar depender de timing real.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('cofre-pessoal-db', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('vault', 'readwrite');
        tx.objectStore('vault').put(new Uint8Array([1, 1]), 'current');
        tx.onabort = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
        tx.abort();
      };
      req.onerror = () => reject(req.error);
    });

    const lido = await storage.readBytes();
    expect(lido).toEqual(new Uint8Array([9, 9, 9]));
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run test/core/vault/vaultStorage.test.ts`
Esperado: FAIL — `src/core/vault/vaultStorage.ts` não existe.

- [ ] **Step 3: Implementar `vaultStorage.ts`**

Criar `src/core/vault/vaultStorage.ts`:

```typescript
const DB_NAME = 'cofre-pessoal-db';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
const RECORD_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class VaultStorage {
  async exists(): Promise<boolean> {
    const db = await openDb();
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).count(RECORD_KEY);
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async readBytes(): Promise<Uint8Array> {
    const db = await openDb();
    try {
      return await new Promise<Uint8Array>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
        req.onsuccess = () => {
          if (req.result === undefined) {
            reject(new Error('Nenhum cofre encontrado no IndexedDB.'));
          } else {
            resolve(req.result as Uint8Array);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  /**
   * Grava [bytes] numa única transação `readwrite`. O IndexedDB garante
   * atomicidade de transação: se a transação não commitar (aba fechada,
   * exceção, etc.), o registro anterior permanece intacto — não existe um
   * estado "parcialmente escrito" possível, ao contrário de um arquivo em
   * disco.
   */
  async writeAtomic(bytes: Uint8Array): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(bytes, RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run test/core/vault/vaultStorage.test.ts`
Esperado: PASS (5 testes).

- [ ] **Step 5: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/core/vault/vaultStorage.ts test/core/vault/vaultStorage.test.ts
git commit -m "$(cat <<'EOF'
Add IndexedDB-backed vault storage with atomic transaction writes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: VaultRepository (orquestração completa)

**Files:**
- Create: `src/core/vault/vaultRepository.ts`
- Test: `test/core/vault/vaultRepository.test.ts`

**Interfaces:**
- Consumes: `VaultKeyManager`, `WrappedDek` (Task 6); `AeadCipher` (Task 3); `VaultHeader`, `CURRENT_VERSION`, exceções (Task 4); `Credential` (Task 5); `VaultFile` (Task 7); `VaultStorage` (Task 8); `Argon2Params`, `interactiveParams` (Task 2).
- Produces: `export class VaultRepository` com `constructor(sodium: Sodium, storage: VaultStorage)`, `createVault(masterPassword: string, params: Argon2Params, initialCredentials?: Credential[]): Promise<void>`, `openVault(masterPassword: string): Promise<Credential[]>`, `changeMasterPassword(currentPassword: string, newPassword: string, params: Argon2Params): Promise<void>`. `initialCredentials` existe só para permitir testar nesta fase que credenciais não aparecem em texto puro no IndexedDB — CRUD completo é Fase 2.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vaultRepository.test.ts`:

```typescript
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sodium } from '../../../src/core/crypto/sodiumProvider';
import { initSodium } from '../../../src/core/crypto/sodiumProvider';
import { interactiveParams, type Argon2Params } from '../../../src/core/crypto/keyDerivation';
import type { Credential } from '../../../src/core/model/credential';
import {
  VaultAuthenticationFailedError,
  VaultNotFoundError,
  VaultUnsupportedVersionError,
} from '../../../src/core/vault/vaultExceptions';
import { VaultRepository } from '../../../src/core/vault/vaultRepository';
import { VaultStorage } from '../../../src/core/vault/vaultStorage';

describe('VaultRepository', () => {
  let sodium: Sodium;
  let params: Argon2Params;
  let repo: VaultRepository;

  beforeAll(async () => {
    sodium = await initSodium();
    params = interactiveParams(sodium);
  });

  beforeEach(() => {
    repo = new VaultRepository(sodium, new VaultStorage());
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cofre-pessoal-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('createVault seguido de openVault com a senha correta devolve lista vazia', async () => {
    await repo.createVault('frase-senha-ficticia', params);

    const credenciais = await repo.openVault('frase-senha-ficticia');

    expect(credenciais).toEqual([]);
  });

  it('openVault sem cofre existente lança VaultNotFoundError', async () => {
    await expect(repo.openVault('qualquer-coisa')).rejects.toThrow(VaultNotFoundError);
  });

  it('openVault com senha errada lança VaultAuthenticationFailedError', async () => {
    await repo.createVault('senha-correta-ficticia', params);

    await expect(repo.openVault('senha-errada-ficticia')).rejects.toThrow(VaultAuthenticationFailedError);
  });

  it('adulterar um byte do arquivo gravado faz openVault falhar com a senha correta', async () => {
    await repo.createVault('senha-correta-ficticia', params);

    const storage = new VaultStorage();
    const bytes = await storage.readBytes();
    const adulterado = new Uint8Array(bytes);
    adulterado[adulterado.length - 1] ^= 0xff; // último byte fica dentro do ciphertext de dados
    await storage.writeAtomic(adulterado);

    await expect(repo.openVault('senha-correta-ficticia')).rejects.toThrow(VaultAuthenticationFailedError);
  });

  it('versão de formato desconhecida lança VaultUnsupportedVersionError', async () => {
    await repo.createVault('senha-correta-ficticia', params);

    const storage = new VaultStorage();
    const bytes = await storage.readBytes();
    const adulterado = new Uint8Array(bytes);
    // Bytes 4-5 = formatVersion (uint16 big-endian). Define uma versão futura inexistente.
    adulterado[4] = 0x00;
    adulterado[5] = 0x63; // 99
    await storage.writeAtomic(adulterado);

    await expect(repo.openVault('senha-correta-ficticia')).rejects.toThrow(VaultUnsupportedVersionError);
  });

  it('changeMasterPassword: senha antiga passa a falhar, nova funciona, dados preservados', async () => {
    await repo.createVault('senha-antiga-ficticia', params);

    await repo.changeMasterPassword('senha-antiga-ficticia', 'senha-nova-ficticia', params);

    await expect(repo.openVault('senha-antiga-ficticia')).rejects.toThrow(VaultAuthenticationFailedError);

    const credenciais = await repo.openVault('senha-nova-ficticia');
    expect(credenciais).toEqual([]);
  });

  it('o registro no IndexedDB não contém a senha mestra nem dados de credenciais em texto puro', async () => {
    const senha = 'frase-senha-super-secreta-de-teste-9x7z';
    const senhaCredencial = 'senha-da-credencial-ficticia-8k2m';
    const nomeServico = 'Serviço Fictício De Teste XYZ';
    const credencial: Credential = {
      id: 'id-ficticio-003',
      serviceName: nomeServico,
      category: 'e-mail',
      username: 'usuario.ficticio.teste@exemplo.invalido',
      password: senhaCredencial,
      tags: [],
      favorite: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await repo.createVault(senha, params, [credencial]);

    const storage = new VaultStorage();
    const bytes = await storage.readBytes();
    const conteudo = Array.from(bytes)
      .filter((b) => b >= 32 && b < 127)
      .map((b) => String.fromCharCode(b))
      .join('');

    expect(conteudo.includes(senha)).toBe(false);
    expect(conteudo.includes(senhaCredencial)).toBe(false);
    expect(conteudo.includes(nomeServico)).toBe(false);
    expect(conteudo.includes('usuario.ficticio.teste')).toBe(false);

    const credenciaisAbertas = await repo.openVault(senha);
    expect(credenciaisAbertas).toHaveLength(1);
    expect(credenciaisAbertas[0]?.serviceName).toBe(nomeServico);
    expect(credenciaisAbertas[0]?.password).toBe(senhaCredencial);
  });
});
```

(O teste de versão desconhecida mira nos bytes 4-5 do arquivo gravado — `formatVersion`, um `uint16` big-endian logo após os 4 bytes do magic, dentro do cabeçalho.)

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run test/core/vault/vaultRepository.test.ts`
Esperado: FAIL — `src/core/vault/vaultRepository.ts` não existe.

- [ ] **Step 3: Implementar `vaultRepository.ts`**

Criar `src/core/vault/vaultRepository.ts`:

```typescript
import type { Sodium } from '../crypto/sodiumProvider';
import { AeadCipher } from '../crypto/aeadCipher';
import type { Argon2Params } from '../crypto/keyDerivation';
import type { Credential } from '../model/credential';
import { VaultAuthenticationFailedError, VaultNotFoundError, VaultUnsupportedVersionError } from './vaultExceptions';
import { VaultFile } from './vaultFormat';
import { CURRENT_VERSION, VaultHeader } from './vaultHeader';
import { VaultKeyManager, type WrappedDek } from './vaultKeyManager';
import { VaultStorage } from './vaultStorage';

export class VaultRepository {
  private readonly keyManager: VaultKeyManager;
  private readonly aead: AeadCipher;

  constructor(
    private readonly sodium: Sodium,
    private readonly storage: VaultStorage,
  ) {
    this.keyManager = new VaultKeyManager(sodium);
    this.aead = new AeadCipher(sodium);
  }

  /**
   * [initialCredentials] existe só para permitir testar nesta fase que
   * credenciais não aparecem em texto puro no IndexedDB. CRUD completo
   * (adicionar após a criação, editar, listar) é Fase 2.
   */
  async createVault(masterPassword: string, params: Argon2Params, initialCredentials: Credential[] = []): Promise<void> {
    const dek = this.keyManager.generateDek();
    try {
      const { header, wrapped } = this.keyManager.wrapNewDek(dek, masterPassword, params);
      const file = this.encryptPayload(header, wrapped, dek, initialCredentials);
      await this.storage.writeAtomic(file.toBytes());
    } finally {
      this.sodium.memzero(dek);
    }
  }

  async openVault(masterPassword: string): Promise<Credential[]> {
    if (!(await this.storage.exists())) {
      throw new VaultNotFoundError();
    }

    const bytes = await this.storage.readBytes();
    const file = VaultFile.fromBytes(bytes);

    if (file.header.formatVersion !== CURRENT_VERSION) {
      throw new VaultUnsupportedVersionError(file.header.formatVersion);
    }

    const dek = this.keyManager.unwrapDek(file.header, file.wrappedDek, masterPassword);
    try {
      return this.decryptPayload(file.header, file, dek);
    } finally {
      this.sodium.memzero(dek);
    }
  }

  async changeMasterPassword(currentPassword: string, newPassword: string, params: Argon2Params): Promise<void> {
    if (!(await this.storage.exists())) {
      throw new VaultNotFoundError();
    }

    const bytes = await this.storage.readBytes();
    const file = VaultFile.fromBytes(bytes);

    if (file.header.formatVersion !== CURRENT_VERSION) {
      throw new VaultUnsupportedVersionError(file.header.formatVersion);
    }

    const dek = this.keyManager.unwrapDek(file.header, file.wrappedDek, currentPassword);
    try {
      const { header, wrapped } = this.keyManager.rewrapDek(dek, newPassword, params);
      const newFile = new VaultFile(header, wrapped, file.dataNonce, file.dataCiphertext);
      await this.storage.writeAtomic(newFile.toBytes());
    } finally {
      this.sodium.memzero(dek);
    }
  }

  private encryptPayload(header: VaultHeader, wrapped: WrappedDek, dek: Uint8Array, credentials: Credential[]): VaultFile {
    const payload = new TextEncoder().encode(JSON.stringify(credentials));
    const nonce = this.aead.generateNonce();
    const ciphertext = this.aead.encrypt(payload, nonce, dek, header.dataAad);
    return new VaultFile(header, wrapped, nonce, ciphertext);
  }

  private decryptPayload(header: VaultHeader, file: VaultFile, dek: Uint8Array): Credential[] {
    try {
      const plain = this.aead.decrypt(file.dataCiphertext, file.dataNonce, dek, header.dataAad);
      return JSON.parse(new TextDecoder().decode(plain)) as Credential[];
    } catch {
      throw new VaultAuthenticationFailedError();
    }
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run test/core/vault/vaultRepository.test.ts`
Esperado: PASS (7 testes).

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npx vitest run`
Esperado: todos os testes das Tasks 1–9 passando.

- [ ] **Step 6: Rodar a checagem de tipos**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/core/vault/vaultRepository.ts test/core/vault/vaultRepository.test.ts
git commit -m "$(cat <<'EOF'
Add VaultRepository orchestrating create/open/change-password flows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Benchmark do Argon2id e relatório de entrega da fase

**Files:**
- Create: `test/core/crypto/argon2idBenchmark.test.ts`
- Create: `docs/fase1-entrega.md`

**Interfaces:**
- Consumes: `KeyDerivation`, `interactiveParams` (Task 2).

- [ ] **Step 1: Escrever o teste de benchmark**

Criar `test/core/crypto/argon2idBenchmark.test.ts`:

```typescript
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
```

- [ ] **Step 2: Rodar o teste e capturar o tempo medido**

Run: `npx vitest run test/core/crypto/argon2idBenchmark.test.ts --reporter=verbose`
Esperado: PASS, com uma linha impressa tipo `Argon2id INTERACTIVE (mem=67108864B, ops=2) no host: <N>ms`. Anotar o valor de `<N>` para o próximo passo.

- [ ] **Step 3: Rodar a checagem de tipos em todo o projeto**

Run: `npx tsc --noEmit`
Esperado: sem erros.

- [ ] **Step 4: Rodar a suíte de testes completa uma última vez**

Run: `npx vitest run`
Esperado: todos os testes passando (Tasks 1–10).

- [ ] **Step 5: Escrever o relatório de entrega da fase**

Criar `docs/fase1-entrega.md` (substituir `<N>` pelo valor medido no Step 2):

```markdown
# Fase 1 (PWA) — Relatório de Entrega

## O que foi construído

Núcleo criptográfico completo do Cofre Pessoal, sem UI: derivação de chave via
Argon2id, envelope encryption da chave do cofre (DEK) protegida por uma chave
derivada da senha mestra (KEK), criptografia autenticada dos dados via
XChaCha20-Poly1305, formato de arquivo binário versionado, gravação atômica
no IndexedDB, e a API de orquestração (`VaultRepository`) usada para criar,
abrir e trocar a senha mestra de um cofre. Tudo em TypeScript, rodando tanto
em Node (testes) quanto em qualquer navegador (produção).

## Bibliotecas usadas

- `libsodium-wrappers-sumo` (`^0.8.4`) — bindings WASM do libsodium (Argon2id
  via variante "sumo", XChaCha20-Poly1305 IETF). Justificativa completa em
  docs/superpowers/specs/2026-09-02-fase1-pwa-nucleo-criptografico-design.md.
- `fake-indexeddb` — só em teste, simula o IndexedDB do navegador no Node.

## Arquivos principais

- `src/core/crypto/` — wrappers de KDF e AEAD sobre o `libsodium-wrappers-sumo`.
- `src/core/vault/` — gerenciamento de chaves, formato binário, storage no
  IndexedDB e o repositório de orquestração.
- `src/core/model/credential.ts` — modelo de dados das credenciais.

## Como rodar os testes

```bash
npm install
npx vitest run
npx tsc --noEmit
```

## Parâmetros do Argon2id — medição provisória

Preset usado nesta fase: `INTERACTIVE` (64 MiB de memória, 2 iterações).

Tempo medido no host de desenvolvimento (Node.js, WASM): **<N> ms**.

**Isto é provisório.** O host de desenvolvimento não é representativo do
Safari rodando num iPhone real — WASM em Safari mobile tende a ser mais
lento que em Node no desktop, e o iPhone 17 Pro Max especificamente é um
aparelho topo de linha, então mesmo uma medição nele não cobre aparelhos mais
fracos que eventualmente rodem este PWA. Antes de qualquer uso além de
testes, este parâmetro precisa ser remedido no Safari do iPhone real, o que
só é possível a partir da fase em que existe uma tela pra abrir (Fase 2). Se
o tempo de desbloqueio for muito alto, considerar reduzir para valores
customizados entre `INTERACTIVE` e o mínimo absoluto; se for baixo o
suficiente, considerar subir para `MODERATE` (256 MiB) para aumentar a
margem de segurança contra ataques offline.

## Limitações conhecidas ao final desta fase

- Sem UI — tudo validado só por testes automatizados.
- Parâmetros do Argon2id não validados no Safari do iPhone real (ver acima).
- Sem manifest/service worker do PWA ainda (nada pra instalar como ícone) —
  isso é Fase 2.
- Sem backup/restauração como funcionalidade de usuário — Fase 5, mas o
  formato do cofre criado aqui já é o que será usado no backup.
- Limpeza de memória: `sodium.memzero(buffer)` é chamado nos `Uint8Array`
  que representam a KEK e a DEK assim que deixam de ser necessários, mas
  isso é uma mitigação best-effort — o V8 (motor JS) não garante que uma
  `string` (como a senha mestra digitada) seja apagada da memória de forma
  determinística; strings em JS são imutáveis e podem ser copiadas
  internamente antes de qualquer tentativa de limpeza. Essa é uma limitação
  da linguagem/motor, não deste código, e é ainda mais pronunciada aqui do
  que já era na tentativa anterior em Dart/Flutter (que ao menos tinha o
  conceito de `SecureKey` com memória nativa protegida para as chaves
  derivadas — o JavaScript não tem equivalente).

## Próxima fase

Fase 2 — senha mestra, desbloqueio, manifest/service worker do PWA (ícone
instalável) e CRUD de credenciais (UI básica), que consome `VaultRepository`
diretamente.
```

- [ ] **Step 6: Commit**

```bash
git add test/core/crypto/argon2idBenchmark.test.ts docs/fase1-entrega.md
git commit -m "$(cat <<'EOF'
Add Argon2id host benchmark and Phase 1 (PWA) delivery report

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
