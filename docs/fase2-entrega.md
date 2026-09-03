# Fase 2 — Relatório de Entrega

## O que foi construído

A primeira interface de usuário do Cofre Pessoal: criação de senha mestra com medidor de força,
desbloqueio, PWA instalável (manifest + service worker via `vite-plugin-pwa`), e CRUD completo de
credenciais (criar, editar, excluir com confirmação, favoritar, categorizar, marcar com tags,
buscar). Tema claro/escuro com override manual. Tudo em Preact sobre o núcleo criptográfico já
existente da Fase 1, através de uma extensão de sessão em memória no `VaultRepository`
(`openSession`/`saveCredentials`/`closeSession`).

## O que fica fora desta fase (propositalmente)

Bloqueio automático por inatividade ou ao ir para segundo plano; proteção contra screenshot/app
recentes; copiar credencial para a área de transferência e sua limpeza automática; gerador de
senhas; backup/restauração; biometria. Tudo isso é das Fases 3, 4 e 5.

## Como rodar

```bash
npm install
npm run dev      # ambiente de desenvolvimento
npx vite build   # build de produção em dist/
```

## Como testar

```bash
npx vitest run
npx tsc --noEmit
```

## Checklist para testar no iPhone real

1. Rodar `npx vite build` e servir a pasta `dist/` (ex.: `npx vite preview`) numa rede acessível
   pelo iPhone, ou publicar num host estático temporário.
2. Abrir o endereço no Safari do iPhone.
3. Tocar em Compartilhar → "Adicionar à Tela de Início".
4. Confirmar que o ícone aparece na tela de início com o nome "Cofre Pessoal".
5. Abrir pelo ícone (não pelo Safari) e confirmar que abre em tela cheia, sem a barra de endereço.
6. Criar uma senha mestra fictícia, adicionar uma credencial fictícia, fechar o app completamente
   (não só minimizar) e reabrir — confirmar que pede a senha mestra e que a credencial ainda está lá.
7. Testar em modo avião (sem internet) depois da primeira visita — confirmar que o app ainda abre
   (funciona offline, graças ao service worker).

## Limitações conhecidas ao final desta fase

- Sem bloqueio automático — o cofre só bloqueia manualmente. Ficar de olho nisso até a Fase 3.
- Ícones do PWA são placeholders sólidos, sem arte de verdade.
- Medidor de força de senha é uma heurística simples (comprimento + diversidade de caracteres),
  não uma estimativa de entropia real.
- Limitações de segurança já documentadas no relatório da Fase 1 (parâmetros do Argon2id ainda
  provisórios, zeroing de memória best-effort) continuam valendo.

## Próxima fase

Fase 3 — bloqueio automático, ocultação em app recentes, clipboard com limpeza automática.
