# Fase 1 (PWA) — Núcleo criptográfico e formato do cofre

Status: aprovado para implementação
Referências: [docs/briefing-cofre-pessoal.md](../../briefing-cofre-pessoal.md) (ver nota de pivô de plataforma no topo), [design Flutter superado](2026-09-02-fase1-nucleo-criptografico-design.md) (mesma arquitetura de criptografia, tecnologia diferente)

## Objetivo

Construir e testar, sem nenhuma tela ainda, o núcleo que protege os dados do Cofre Pessoal rodando no navegador: derivação de chave a partir da senha mestra, envelope encryption da chave do cofre, criptografia autenticada dos dados, formato de arquivo versionado, gravação atômica no IndexedDB e recuperação de gravação interrompida. É a mesma arquitetura de segurança já validada na versão Flutter, reimplementada em TypeScript.

Fora de escopo desta fase: qualquer tela, biometria (removida do escopo do projeto — só senha mestra), clipboard, gerador de senhas, manifest/service worker do PWA (isso é Fase 2, quando existe algo pra instalar), backup/restauração como funcionalidade de usuário (Fase 5 — mas o formato do cofre criado aqui é o mesmo que será usado no backup).

## O que muda em relação à versão Flutter (e o que não muda)

**Não muda:** o desenho de envelope encryption (DEK de 256 bits protegida por uma KEK derivada via Argon2id; dados protegidos com a DEK via XChaCha20-Poly1305; troca de senha mestra só reembrulha a DEK); o formato binário do arquivo do cofre; a decisão de AAD (cabeçalho autentica a chave embrulhada, mas não a seção de dados); os parâmetros provisórios do Argon2id; o modelo de ameaças; os cenários de teste.

**Muda:** a linguagem (TypeScript em vez de Dart), a biblioteca de criptografia (`libsodium-wrappers-sumo`, o binding JS/WASM do libsodium, em vez do pacote Dart `sodium`), o armazenamento (IndexedDB do navegador em vez de arquivo no sistema operacional), a ferramenta de build/teste (Vite + Vitest em vez de `flutter`/`flutter test`).

## Arquitetura

```
src/core/crypto/   keyDerivation.ts, aeadCipher.ts — wrappers finos sobre libsodium-wrappers-sumo
src/core/vault/    vaultKeyManager.ts, vaultFormat.ts, vaultStorage.ts, exceções de domínio
src/core/model/    credential.ts (modelo de dados puro)
```

TypeScript puro, sem nenhuma dependência de UI — roda em `vitest` no Node, sem precisar de navegador real (libsodium-wrappers-sumo funciona em Node via WASM da mesma forma que no browser).

**Biblioteca criptográfica:** `libsodium-wrappers-sumo` (pacote npm, versão atual publicada em 2026-04, mantido; depende de `libsodium-sumo` para o binário WASM). A variante "sumo" é necessária porque `crypto_pwhash` (Argon2id) só está disponível nela — a variante padrão (`libsodium-wrappers`) não inclui pwhash, exatamente como aconteceu no binding Dart. Inicialização: `import sodium from 'libsodium-wrappers-sumo'; await sodium.ready;`.

## Modelo de dados

```typescript
export interface Credential {
  id: string;              // uuid v4
  serviceName: string;
  category: string;
  url?: string;
  username?: string;
  password: string;
  notes?: string;
  tags: string[];
  favorite: boolean;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
}
```

Payload do cofre = `Credential[]` serializado em JSON antes de criptografar.

## Gerenciamento de chaves (envelope encryption) — inalterado em relação à versão Flutter

- **DEK**: 256 bits aleatórios (`sodium.randombytes_buf(32)`), gerada uma vez na criação do cofre.
- **KEK**: derivada da senha mestra via Argon2id + salt aleatório de 16 bytes (`sodium.crypto_pwhash_SALTBYTES`), nunca persistida.
- Criar cofre → gera DEK → gera salt → deriva KEK → embrulha DEK com KEK (AEAD, AAD = cabeçalho) → criptografa payload inicial (`[]`) com DEK (AEAD, AAD = magic+versão) → grava.
- Abrir cofre → lê cabeçalho → deriva KEK com salt+params do cabeçalho e a senha informada → desembrulha DEK → decifra payload com DEK.
- Trocar senha mestra → gera novo salt → deriva nova KEK → reembrulha a mesma DEK → grava novo cabeçalho + nova seção de chave; dados não tocados.

Limitação de memória: JavaScript não garante zeroing de `string`/`Uint8Array` (o V8 pode copiar/realocar antes de qualquer tentativa de limpeza) — mesma limitação já documentada na versão Flutter, só que agora sem nem o paliativo do `SecureKey.dispose()` do libsodium nativo (o `libsodium-wrappers-sumo` no entanto expõe `sodium.memzero(buffer)` para os `Uint8Array` que passam por nós, que usamos onde possível).

## Formato do arquivo (v1) — idêntico ao da versão Flutter

```
magic            4 bytes   "CPV1"
formatVersion    2 bytes   uint16 big-endian, = 1
kdfMemLimit      4 bytes   uint32
kdfOpsLimit      4 bytes   uint32
salt             16 bytes  crypto_pwhash_SALTBYTES
wrapNonce        24 bytes  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
wrapCiphertext   48 bytes  DEK (32B) + tag Poly1305 (16B)
dataNonce        24 bytes
dataLength       4 bytes   uint32
dataCiphertext   N bytes   payload JSON cifrado + tag (16B ao final)
```

AAD: seção de chave embrulhada usa o cabeçalho inteiro como AAD (bloqueia downgrade de parâmetros do Argon2id); seção de dados usa só `magic+formatVersion` (permite trocar senha sem recriptografar dados). Representado em runtime como `Uint8Array`, serializado/parseado com `DataView`.

**O que fica visível a quem copiar os dados do IndexedDB sem a senha:** mesma coisa da versão Flutter — versão do formato, parâmetros do Argon2id, salt. Nenhum revela conteúdo do cofre.

## Armazenamento (IndexedDB) — a peça nova desta versão

Em vez de um arquivo no sistema de arquivos, o blob binário do cofre (a saída de `toBytes()`) é guardado como um único registro no IndexedDB, num banco dedicado (`cofre-pessoal-db`), object store `vault`, chave fixa `'current'`.

Gravação "atômica": IndexedDB já garante que uma transação `readwrite` é atômica (tudo ou nada) — não existe o equivalente ao problema de "gravação interrompida no meio" que existia com arquivo + rename, porque o navegador não expõe uma API de escrita direta em arquivo com esse risco. A transação grava o registro `'current'` inteiro de uma vez; se a aba fechar no meio, a transação nunca commitou e o registro anterior (se existia) permanece intacto. Isso simplifica bastante essa parte do design original (não precisamos do padrão `.tmp` + rename).

Isso já basta para a garantia "se a escrita falhar, o cofre anterior continua acessível": a atomicidade da transação do IndexedDB é a própria garantia — não é preciso guardar manualmente uma cópia do valor anterior em memória, como seria necessário com escrita direta em arquivo. Se a transação de `put('current', novosBytes)` não commitar (aba fechada, exceção, etc.), o registro anterior simplesmente permanece como estava; não existe um estado "parcialmente escrito" possível.

## Erros de domínio (nomes iguais aos da versão Flutter, adaptados para TS)

`VaultNotFoundError`, `VaultUnsupportedVersionError` (carrega `foundVersion`), `VaultCorruptHeaderError` (carrega `reason`), `VaultAuthenticationFailedError` (senha incorreta **ou** ciphertext/cabeçalho adulterado — indistinguíveis por construção). Todas estendem `Error`, mensagens em português, nunca incluem senha/chave/conteúdo decifrado.

## Parâmetros do Argon2id (provisórios) — mesma decisão da versão Flutter

Baseline: preset `INTERACTIVE` do libsodium (`sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE`, `sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE` — 64 MiB, 2 iterações). Provisório: será medido no Safari do iPhone real do usuário assim que houver algo pra abrir no navegador (Fase 2), não é possível medir de forma representativa só no host de desenvolvimento. Argon2id em WASM tende a ser mais lento que uma implementação nativa (C) — motivo a mais para essa fase medir no host como proxy grosseiro e documentar, sem tratar como validação final.

## Testes

Mesmos cenários da versão Flutter, adaptados para Vitest: vetor conhecido do libsodium (Argon2id, mesmo vetor oficial já verificado — `crypto_pwhash` com os mesmos parâmetros e saída esperada, já que é o mesmo libsodium por baixo); ciclo completo criar→abrir; senha errada; adulteração do ciphertext de dados; adulteração do cabeçalho (prova do AAD); unicidade estatística de nonces; troca de senha mestra preservando dados; versão de formato desconhecida rejeitada; nenhum texto puro (senha/credenciais) nos bytes gravados no IndexedDB; gravação "atômica" simulando falha (não há mais cenário de arquivo `.tmp` órfão — o teste equivalente aqui é: transação que nunca commita não deve alterar o registro anterior).

## Critério de conclusão da fase

Todos os testes passando via `npx vitest run`; `npx tsc --noEmit` sem erros; relatório de entrega com os parâmetros medidos do Argon2id e a ressalva de que precisam validação no iPhone real.
