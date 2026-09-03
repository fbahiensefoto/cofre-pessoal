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

Tempo medido no host de desenvolvimento (Node.js, WASM): **86.3 ms**.

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
- Risco real de perda de dados no iOS: o Safari pode descartar ("evict") o
  IndexedDB de um site após cerca de 7 dias sem interação, exceto quando o
  site foi adicionado à tela de início (instalado como PWA) — nesse caso essa
  política de descarte não se aplica. Como esta fase ainda não tem
  backup/restauração (Fase 5) e o IndexedDB é hoje a única cópia do cofre,
  isso torna "adicionar à tela de início" um requisito prático, não apenas
  uma conveniência, até que o backup exista.
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
