# Fase 2 — Senha mestra, desbloqueio, PWA instalável e CRUD de credenciais

Status: aprovado para implementação
Referências: [docs/briefing-cofre-pessoal.md](../../briefing-cofre-pessoal.md), [Fase 1 — spec](2026-09-02-fase1-pwa-nucleo-criptografico-design.md), [Fase 1 — relatório de entrega](../../fase1-entrega.md)

## Objetivo

Construir a primeira interface de usuário do Cofre Pessoal, consumindo diretamente o núcleo criptográfico da Fase 1 (já testado e mesclado em `main`): criação da senha mestra, desbloqueio, um PWA de verdade instalável no iPhone (ícone na tela de início, funciona offline), e o CRUD completo de credenciais.

Ao final desta fase, existe algo real para usar no iPhone — ainda sem os refinamentos de bloqueio automático, biometria, gerador de senhas ou backup, que são fases seguintes.

## Fora de escopo desta fase

Bloqueio automático por inatividade ou ao ir para segundo plano; proteção contra screenshot/app recentes; limpeza automática de clipboard; gerador de senhas; backup/restauração; biometria. Essas ficam para as Fases 3, 4 e 5, como já estava definido no briefing original. A tela de "Configurações" desta fase é mínima (troca de senha mestra e tema) — as configurações de segurança mais avançadas chegam junto com as funcionalidades que elas controlam.

## Extensão do núcleo (Fase 1 → Fase 2)

O `VaultRepository` da Fase 1 só expõe operações que abrem e fecham o cofre inteiro numa única chamada (`createVault`, `openVault`, `changeMasterPassword`) — cada uma deriva a chave a partir da senha mestra internamente e nunca expõe a DEK para fora. Isso é adequado para os testes da Fase 1, mas não serve para uma UI real: pedir a senha mestra de novo a cada edição de credencial seria inutilizável.

Adiciona-se ao `VaultRepository` (sem modificar `createVault`/`openVault`/`changeMasterPassword`, que continuam exatamente como estão, já revisados):

```typescript
export interface VaultSession {
  dek: Uint8Array;
  header: VaultHeader;
}

openSession(masterPassword: string): Promise<{ session: VaultSession; credentials: Credential[] }>;
saveCredentials(session: VaultSession, credentials: Credential[]): Promise<void>;
closeSession(session: VaultSession): void; // sodium.memzero(session.dek)
```

`openSession` reaproveita a mesma lógica de `openVault` (checar existência, checar versão, desembrulhar a DEK), mas devolve a DEK dentro de `session` em vez de zerá-la ao final. `saveCredentials` reencripta a lista inteira com a DEK da sessão (gerando um novo `dataNonce`) e grava atomicamente — sem tocar na seção de chave embrulhada. A sessão vive só em memória, nunca é persistida; fechar o app ou dar lock também deve chamar `closeSession`.

## Arquitetura de arquivos

```
src/
  core/                         (Fase 1, inalterado)
  ui/
    App.tsx                     roteamento simples por estado (sem router)
    main.tsx                    bootstrap, monta App em #root
    state/
      VaultSessionContext.tsx   contexto Preact: sessão atual, lista de credenciais, ações
    screens/
      WelcomeScreen.tsx         primeira execução: criar senha mestra + medidor de força
      UnlockScreen.tsx          execuções seguintes: desbloqueio
      VaultListScreen.tsx       lista + busca + filtro por favorito/categoria
      CredentialDetailScreen.tsx  visualizar uma credencial, revelar senha
      CredentialFormScreen.tsx    criar/editar (mesmo componente, modo controlado por prop)
      SettingsScreen.tsx        trocar senha mestra, alternar tema
    components/
      PasswordStrengthMeter.tsx
      CredentialListItem.tsx
      ConfirmDialog.tsx         confirmação reforçada para exclusão
      CategoryBadge.tsx
      TagList.tsx
    styles/
      theme.css                 variáveis CSS para tema claro/escuro (prefers-color-scheme + override manual)
index.html
public/
  icons/                        ícones do PWA em múltiplos tamanhos (gerados a partir de uma arte fictícia simples)
vite.config.ts                  adiciona vite-plugin-pwa
```

## Fluxo de dados

`VaultSessionContext` é a única fonte de verdade da sessão desbloqueada: guarda a `VaultSession` (com a DEK) e a lista de `Credential[]` decifrada em memória. Toda ação de CRUD (criar/editar/excluir/favoritar) atualiza o array local e chama `saveCredentials` para persistir — otimista na UI, mas cada chamada aguarda a escrita no IndexedDB confirmar antes de considerar a ação concluída. Buscar e filtrar acontecem inteiramente sobre o array em memória (já decifrado), nunca tocam o IndexedDB.

`WelcomeScreen` chama `createVault` (Fase 1) diretamente na criação, depois `openSession` para entrar já na lista. `UnlockScreen` chama `openSession`. Um botão de "bloquear" manual em qualquer tela chama `closeSession` e volta para `UnlockScreen`.

## PWA

`vite-plugin-pwa` gera o `manifest.json` (nome "Cofre Pessoal", ícones, `display: "standalone"`, cor de tema) e um service worker com estratégia de cache "precache do app shell" — os arquivos estáticos (HTML/CSS/JS) ficam disponíveis offline após a primeira visita; não há dados para sincronizar em rede, então não existe estratégia de cache de API alguma. Sem isso, o app não pode ser adicionado à tela de início como um ícone de verdade.

## Medidor de força de senha

Sem biblioteca externa nesta fase — um cálculo simples baseado em comprimento e diversidade de caracteres (classes usadas: minúsculas, maiúsculas, números, símbolos) é suficiente para orientar visualmente o usuário, sem prometer uma métrica de entropia precisa. Aceita espaços e frases longas; não impõe regras de composição obrigatórias, conforme já definido no briefing.

## Acessibilidade e tema

Tema claro/escuro via `prefers-color-scheme` com opção manual de override salva localmente (fora do cofre, é só uma preferência de UI, não um dado sensível). Áreas de toque mínimas de 44×44px. Rótulos ARIA nos campos de formulário e botões de ação (copiar, revelar, excluir). Confirmação explícita antes de qualquer exclusão.

## Testes

Núcleo (Fase 1) já coberto. Fase 2 adiciona testes de componente com `@testing-library/preact` + Vitest: fluxo de criação de senha mestra (incluindo confirmação de senha e medidor de força), desbloqueio com senha certa/errada, CRUD completo de credencial (criar → aparece na lista → editar → mudança refletida → excluir com confirmação → some da lista), busca filtrando corretamente, e que os dados persistem entre "sessões" (fechar e reabrir a sessão via `openSession`/`closeSession` real, não mockado).

## Critério de conclusão da fase

Testes de componente e do núcleo estendido passando; `tsc --noEmit` limpo; app buildado com `vite build` instalável no Safari do iPhone (testado manualmente pelo usuário — checklist no relatório de entrega); nenhuma senha ou dado de credencial aparece em texto puro no bundle ou no IndexedDB.
