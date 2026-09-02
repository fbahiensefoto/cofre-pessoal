# Fase 1 — Núcleo criptográfico e formato do cofre

> **SUPERADO (2026-09-02):** o projeto pivotou de app nativo Flutter/iOS para um PWA (site instalável, sem Xcode/App Store) — ver a nota no topo de `docs/briefing-cofre-pessoal.md`. As decisões de criptografia, formato do cofre e modelo de ameaças aqui continuam válidas em espírito (mesma Argon2id + XChaCha20-Poly1305, mesmo envelope encryption) e serão reaproveitadas na nova spec do PWA — mas os detalhes específicos de Dart/Flutter/`sodium` (pacote) abaixo não se aplicam mais.

Status: aprovado para implementação (versão Flutter nativo — superada)
Referência: [docs/briefing-cofre-pessoal.md](../../briefing-cofre-pessoal.md)

## Objetivo

Construir e testar, sem nenhuma UI, o núcleo que protege os dados do Cofre Pessoal: derivação de chave a partir da senha mestra, envelope encryption da chave do cofre, criptografia autenticada dos dados, formato de arquivo versionado, gravação atômica e recuperação de gravação interrompida. É a base sobre a qual todas as fases seguintes (UI, biometria, backup) se apoiam.

Fora de escopo desta fase: qualquer tela, biometria, clipboard, gerador de senhas, backup/restauração como funcionalidade de usuário (o formato do cofre criado aqui é o mesmo usado depois para backup, mas o fluxo de exportar/importar fica para a Fase 5).

## Modelo de ameaças relevante para esta fase

Do modelo de ameaças geral (ver briefing), esta fase é responsável por mitigar diretamente:

- Cópia dos arquivos internos do app / cópia de backup do dispositivo → sem a senha mestra, o arquivo não revela dados.
- Tentativas offline de descobrir a senha mestra → mitigado por Argon2id com parâmetros custosos.
- Alteração maliciosa do arquivo criptografado → detectada pela tag de autenticação da AEAD (dados e cabeçalho).
- "Downgrade" dos parâmetros do Argon2id por adulteração do cabeçalho → mitigado ligando os parâmetros ao AAD da seção de chave embrulhada.
- App encerrado durante uma gravação → mitigado pelo padrão de escrita atômica.

Esta fase **não** mitiga (fica para fases seguintes ou é limitação permanente, já documentada no briefing): malware com controle total do aparelho, captura de senha mestra digitada, ataques físicos avançados.

## Arquitetura

```
lib/core/crypto/   KeyDerivation, Aead, SecureRandom — wrappers finos sobre `sodium`
lib/core/vault/    VaultKeyManager, VaultFormat, VaultStorage, exceptions
lib/core/model/    Credential (modelo de dados puro)
```

Camada 100% Dart, sem dependência de widgets/Flutter engine — roda em `flutter test` no host, sem emulador ou dispositivo.

**Biblioteca criptográfica:** pacote `sodium` (bindings Dart/Flutter para libsodium via FFI/build hooks nativos). Escolhido em vez do pacote `cryptography` (pure Dart) porque:
1. É a implementação de referência de XChaCha20-Poly1305 e Argon2id (libsodium é a origem de ambos os algoritmos).
2. Argon2id em código nativo é significativamente mais rápido que em Dart puro — relevante porque afeta diretamente o tempo de desbloqueio percebido pelo usuário a cada abertura do app.
3. É a mesma lib usada por outros gerenciadores de senha e ferramentas de segurança respeitadas.

Custo aceito: passo de build nativo (NDK no Android) via a feature de build hooks do Dart.

## Modelo de dados

```dart
class Credential {
  final String id;              // uuid v4, gerado localmente
  final String serviceName;
  final String category;
  final String? url;
  final String? username;
  final String password;
  final String? notes;
  final List<String> tags;
  final bool favorite;
  final DateTime createdAt;
  final DateTime updatedAt;
}
```

Payload do cofre = `List<Credential>` serializada em JSON antes de criptografar. CRUD sobre isso é Fase 2 — aqui só definimos o shape porque é o que é criptografado/testado.

## Gerenciamento de chaves (envelope encryption)

- **DEK** (Data Encryption Key): 256 bits aleatórios, gerados uma única vez na criação do cofre, nunca muda de valor (só é reembrulhada).
- **KEK** (Key Encryption Key): derivada da senha mestra via Argon2id + salt aleatório de 16 bytes, nunca persistida.
- Criar cofre: gera DEK → gera salt → deriva KEK → embrulha DEK com KEK (AEAD) → criptografa payload inicial (`[]`) com DEK (AEAD) → grava.
- Abrir cofre: lê cabeçalho → deriva KEK com salt+params do cabeçalho e a senha informada → desembrulha DEK → decifra payload com DEK.
- Trocar senha mestra: abre cofre (precisa da senha atual) → gera novo salt → deriva nova KEK → reembrulha a **mesma** DEK → grava novo cabeçalho + nova seção de chave; a seção de dados não é tocada.

Nunca a senha mestra nem a DEK em texto puro tocam o disco. Ambas ficam em memória pelo tempo mínimo necessário à operação em curso — limitação conhecida: Dart não garante zeroing de memória (`String` é imutável e pode ser realocado/copiado pelo GC antes de qualquer tentativa de limpeza); onde o pacote `sodium` expõe buffers `SecureKey` mutáveis, usamos e limpamos explicitamente com `.dispose()`; para os pontos onde isso não é possível (ex.: a `String` da senha vinda de um campo de texto), documentamos a limitação em vez de fingir uma garantia que não existe.

## Formato do arquivo (v1)

Layout binário, campos de tamanho fixo ou prefixados por tamanho:

```
magic            4 bytes   "CPV1"
formatVersion    2 bytes   uint16 big-endian, = 1
kdfMemLimit      4 bytes   uint32, bytes de memória do Argon2id
kdfOpsLimit      4 bytes   uint32, iterações do Argon2id
salt             16 bytes  salt do Argon2id
wrapNonce        24 bytes  nonce da seção de chave embrulhada
wrapCiphertext   48 bytes  DEK (32B) + tag Poly1305 (16B), cifrados
dataNonce        24 bytes  nonce da seção de dados
dataLength       4 bytes   uint32, tamanho do ciphertext de dados
dataCiphertext   N bytes   payload JSON cifrado + tag Poly1305 (16B ao final)
```

AAD (dados associados autenticados, não cifrados mas autenticados):
- Seção de chave embrulhada: AAD = `magic + formatVersion + kdfMemLimit + kdfOpsLimit + salt` (todo o cabeçalho até aqui). Isso impede adulterar os parâmetros do Argon2id ou o salt sem invalidar a chave embrulhada — bloqueia ataque de downgrade.
- Seção de dados: AAD = `magic + formatVersion` apenas. Deliberadamente **não** inclui salt/params, para que a troca de senha mestra só precise reescrever a seção de chave, sem recriptografar os dados.

**O que fica visível a quem copiar o arquivo sem a senha:** que é um arquivo do Cofre Pessoal (magic), a versão do formato, os parâmetros do Argon2id em uso e o salt. Nenhum desses campos revela conteúdo do cofre. Os parâmetros do Argon2id revelam o custo aproximado de um ataque de força bruta — informação que não ajuda um atacante além do que ele já poderia inferir tentando abrir o arquivo.

## Gravação atômica e recuperação

- Escreve o conteúdo novo em `<vault>.tmp` no mesmo diretório do arquivo final.
- `flush`/`sync` do arquivo temporário antes de prosseguir.
- `rename` de `<vault>.tmp` para `<vault>` — atômico no mesmo filesystem (ext4/f2fs no armazenamento interno do Android).
- Na inicialização do `VaultStorage`, se existir um `.tmp` órfão:
  - Se o arquivo final também existe e é válido → o `.tmp` é lixo de uma escrita interrompida; é apagado, arquivo final prevalece.
  - Se o arquivo final não existe → a criação do cofre nunca completou; `.tmp` é apagado, estado tratado como "nenhum cofre existe".

## Erros de domínio

`VaultNotFoundException`, `VaultUnsupportedVersionException`, `VaultCorruptHeaderException` (estrutura ilegível/truncada), `VaultAuthenticationFailedException` (senha incorreta **ou** ciphertext/cabeçalho adulterado — indistinguíveis por construção, é a garantia que a AEAD dá). Nenhuma mensagem de exceção inclui senha, chave ou conteúdo decifrado.

## Parâmetros do Argon2id (provisórios)

Baseline: preset `INTERACTIVE` do libsodium — 64 MiB de memória, `opslimit` 2. Escolhido como ponto de partida conservador para não pesar em aparelhos de entrada. **Isto é provisório**: será medido em dispositivo Android real assim que houver um app rodando (não é possível medir de forma representativa só no host de desenvolvimento). Nesta fase, o benchmark é feito via teste automatizado no host, apenas como proxy grosseiro, e o resultado é documentado no relatório de entrega da fase — não é a validação final.

## Testes

- Vetores de teste conhecidos do Argon2id (RFC 9106) contra o binding `sodium`, para confirmar que a integração está correta.
- Ciclo completo: criar cofre → abrir com a senha correta → payload decifrado igual ao original.
- Abrir com senha errada → `VaultAuthenticationFailedException`, nenhum dado parcial retornado.
- Adulterar um byte do `dataCiphertext` → falha na abertura.
- Adulterar um byte do `salt` ou dos parâmetros do Argon2id → falha na abertura (prova que o AAD do cabeçalho está funcionando).
- Gerar N cifragens e checar unicidade dos nonces produzidos; confirmar que decifrar com um nonce trocado falha.
- Trocar a senha mestra → senha antiga passa a falhar, nova senha abre o cofre, payload decifrado idêntico ao anterior à troca.
- Simular gravação interrompida (criar `.tmp` parcial e não completar o rename) → reabrir aponta para o cofre original intacto; `.tmp` órfão é removido.
- Versão de formato desconhecida (`formatVersion` maior que o suportado) → `VaultUnsupportedVersionException`.
- Verificação de que o arquivo final, em bytes brutos, não contém nenhum trecho da senha mestra ou dos valores em texto puro usados no teste.

## Critério de conclusão da fase

Todos os testes acima passando via `flutter test`; nenhum aviso do analisador estático (`flutter analyze`); relatório de entrega da fase com os parâmetros medidos do Argon2id e a ressalva explícita de que precisam revalidação em dispositivo real.
