# Cofre Pessoal — Briefing de Desenvolvimento (versão ajustada)

> Esta é uma revisão do briefing original. O conteúdo técnico e os requisitos de segurança foram preservados quase integralmente — as mudanças são: (1) o trabalho foi dividido em fases com checkpoint de aprovação entre elas, em vez de um único ciclo monolítico de 17 etapas; (2) decisões que o briefing original deixava em aberto foram fechadas, com justificativa, para que o desenho técnico possa começar sem bloqueios. Qualquer decisão abaixo pode ser revertida — está marcada como tal para facilitar.

> **Pivô de plataforma (2026-09-02):** o briefing original e a primeira tentativa de execução eram para um app nativo Flutter (Android então iOS). Isso travou de forma irrecuperável no ambiente disponível — o pacote de criptografia escolhido exige o Xcode completo (não só o Command Line Tools) até para rodar os testes no Mac de desenvolvimento, e instalar o Xcode exige login com Apple ID e comandos com senha de administrador, coisas que não posso fazer pelo usuário. Durante essa conversa, o usuário esclareceu o que realmente queria: um site instalável (PWA — Progressive Web App), com ícone na tela de início do iPhone, hospedado gratuitamente no GitHub Pages, sem servidor e sem sincronização — as senhas continuam só no aparelho do usuário. Isso elimina a necessidade de Xcode/App Store por completo e é compatível com toda a modelagem de segurança já feita (Argon2id, XChaCha20-Poly1305, envelope encryption, sem nuvem, sem telemetria) — só muda a tecnologia de implementação, de Dart/Flutter para JavaScript/TypeScript rodando no navegador. As seções abaixo que mencionam Flutter/Android/iOS nativo refletem a versão anterior; a arquitetura de fato usada é a de PWA descrita na spec correspondente.

## Papel e princípios gerais

Atue como arquiteto de segurança, especialista em criptografia aplicada, desenvolvedor front-end sênior (PWA) e responsável pela qualidade do projeto.

Construa, no diretório atual, um aplicativo web instalável (PWA) de gerenciamento de senhas chamado provisoriamente "Cofre Pessoal": interface em português do Brasil, testado principalmente no Safari do iPhone do usuário (iPhone 17 Pro Max), hospedado como site estático no GitHub Pages, código em repositório privado no GitHub (só código/testes/docs — nunca dados do cofre).

Regras que valem para todas as fases:

- Offline-first, sem servidor próprio, sem conta online, sem sync na nuvem, sem anúncios, sem analytics/telemetria/rastreamento, sem chamadas de rede. Nenhuma dependência de Neon, Firebase, Supabase ou qualquer backend remoto.
- Nunca implemente algoritmos criptográficos manualmente. Use apenas bibliotecas consolidadas, mantidas e documentadas — justifique cada escolha antes de adotá-la.
- Use exclusivamente credenciais e dados fictícios durante todo o desenvolvimento (inclusive testes e demonstrações).
- Não crie repositório remoto nem execute `git push` sem autorização explícita minha. Prepare tudo localmente e mostre os comandos.
- Não declare o app "100% seguro" ou pronto para credenciais bancárias antes de auditoria independente.
- Tome decisões razoáveis quando algo não estiver especificado; só pergunte quando a escolha puder mudar o modelo de segurança de forma relevante.

## Decisões técnicas fechadas (revertíveis)

O briefing original deixava estas escolhas em aberto ou pedia para eu justificar durante o desenvolvimento. Fechando agora para não bloquear o desenho:

| Decisão | Escolha | Justificativa |
|---|---|---|
| Cifra autenticada | **XChaCha20-Poly1305** (não AES-256-GCM) | Nonce de 192 bits torna reuso de nonce por geração aleatória estatisticamente irrelevante mesmo em milhões de operações; implementação em software é naturalmente resistente a ataques de tempo (sem depender de aceleração AES-NI, que nem todo hardware Android tem); bibliotecas como `cryptography` (Dart, mantida pela comunidade, usada em produção) e libsodium expõem isso de forma auditada. |
| Derivação de chave | Argon2id (mantido do original) | Já era a escolha certa; será *benchmarkado no dispositivo real já na Fase 1*, não deixado para depois. |
| Formato de armazenamento | **Arquivo único de cofre criptografado** (envelope + blob), não SQLite/SQLCipher | O volume de dados é pequeno (dezenas/centenas de credenciais), toda a informação já é criptografada por completo, e um blob único simplifica gravação atômica, backup e restauração. Evita a complexidade de compilar SQLCipher nativamente para Android/iOS sem ganho real neste volume. |
| Chave de recuperação de alta entropia | **Fora do MVP** | Adiciona outro segredo para proteger e gerenciar, e outra superfície de ataque, sem benefício claro numa v1 offline-first sem conta. O formato do cofre será desenhado para permitir adicionar isso depois (uma cópia adicional da chave do cofre, protegida por essa chave de recuperação) sem quebrar compatibilidade. |
| minSdkVersion (Android) | **API 26 (Android 8.0)** | Garante disponibilidade consistente de Android Keystore com suporte a chaves com contrapartida de hardware; versões anteriores têm suporte parcial/inconsistente ao StrongBox e às APIs biométricas usadas aqui. |
| Gerenciamento de estado (Flutter) | **Riverpod** | Boa injeção de dependência para testes (essencial dado quanto o projeto exige testabilidade de criptografia/biometria/clipboard), mais simples que Bloc, mais robusto que Provider puro para este tamanho de projeto. |
| Persistência local | I/O de arquivo direto (`path_provider` + escrita atômica), sem `sqflite`/ORM | Consequência direta da decisão de "arquivo único de cofre". |

## Escopo e fases

O escopo original é o de um gerenciador de senhas completo (cripto, biometria, backup transacional, gerador, CI com scanning de segredos, ~15 documentos/artefatos, suíte de testes cobrindo ~20 cenários). Tentar entregar tudo em um único plano de implementação é a maior fonte de risco deste projeto — alguma parte sairia rasa. Proposta: dividir em fases, cada uma com seu próprio ciclo **spec → plano → implementação → revisão** antes de avançar para a próxima.

**Fase 1 — Núcleo criptográfico e formato do cofre** (sem UI)
Modelo de ameaças documentado; envelope encryption (Argon2id + XChaCha20-Poly1305); geração/derivação/troca de chave; formato de arquivo versionado; gravação atômica e recuperação de gravação interrompida; falha segura em senha errada e em adulteração; testes de todos esses cenários com vetores conhecidos onde aplicável.

**Fase 2 — Senha mestra, desbloqueio e CRUD de credenciais (UI básica)**
Criação de senha mestra com medidor de força; tela de desbloqueio; listagem, criação, edição, exclusão de credenciais; categorias, tags, favoritos, busca (só pós-descriptografia); tema claro/escuro; acessibilidade básica.

**Fase 3 — Bloqueio, privacidade e clipboard**
Bloqueio manual/automático/por inatividade; ocultação em app recentes; bloqueio de screenshot (Android) / overlay de privacidade (iOS); revelar/ocultar senha; copiar usuário/senha com limpeza automática do clipboard.

**Fase 4 — Biometria**
Integração com Android Keystore / iOS Keychain-Secure Enclave; proteção da chave do cofre via biometria; invalidação ao mudar biometria cadastrada; expiração periódica exigindo senha mestra.

**Fase 5 — Gerador de senhas, backup e restauração**
Gerador de senhas e frases-senha sem viés de módulo; backup criptografado completo; restauração com validação antes de substituir o cofre; cópia transacional de segurança.

**Fase 6 — Segurança de repositório, CI/CD e documentação final**
`.gitignore` rigoroso; GitHub Actions (formatação, análise estática, testes, scanning de segredos, dependências, build de validação sem assinatura); toda a documentação (README, SECURITY.md, arquitetura, modelo de ameaças, especificação do formato, checklist de auditoria).

Cada fase termina com testes passando e uma revisão minha antes de eu autorizar a próxima. Isso substitui as "17 etapas" do briefing original, que ficam como referência de conteúdo, não como sequência de execução ininterrupta.

## Modelo de ameaças (conteúdo mantido do original)

Considerar: celular perdido/roubado bloqueado; roubado desbloqueado com cofre fechado; app aberto no momento do roubo; cópia de arquivos internos; cópia de backup do dispositivo; ataque offline à senha mestra; adulteração do arquivo criptografado; vazamento por clipboard; por screenshot/app recentes; por logs/crash reports/temporários; uso em aparelho com root/jailbreak (detecção é alerta, não barreira confiável — documentar que pode ser contornada); dependência maliciosa/comprometida; backup interceptado; máquina de desenvolvimento ou conta GitHub comprometidas.

Documentar explicitamente o que o app **não** consegue impedir: malware com controle total do aparelho, SO comprometido, teclado malicioso, captura externa de tela, câmera apontada para a tela, usuário revelando a senha mestra, aparelho roubado com cofre aberto, ataque físico avançado.

## Arquitetura criptográfica

Envelope encryption: chave aleatória de 256 bits para os dados do cofre → protegida por chave derivada da senha mestra via Argon2id (salt aleatório exclusivo, parâmetros armazenados no cabeçalho) → dados protegidos com a chave do cofre via XChaCha20-Poly1305 (ver justificativa na tabela acima). Senha mestra nunca é armazenada; chave do cofre nunca em texto puro. Trocar a senha mestra reprotege apenas o envelope da chave, sem recriptografar credenciais individualmente.

Requisitos: nonces aleatórios únicos, nunca reutilizados com a mesma chave; RNG criptograficamente seguro; detecção de qualquer alteração no ciphertext (AEAD cobre isso); falha segura em senha errada e em arquivo adulterado, sem mensagens que revelem conteúdo; formato versionado com plano de migração; gravação atômica com recuperação segura se o app for encerrado no meio da escrita.

Todos os campos são criptografados (nome do serviço, categoria, URL, usuário, senha, observações, tags, favorito). Se algum metadado do cofre permanecer visível no arquivo (ex.: versão do formato, parâmetros do Argon2id, timestamps de arquivo do SO), documentar exatamente o que isso revela a quem copiar o arquivo.

Minimizar tempo de vida de segredos em memória; documentar as limitações reais do Dart/Flutter e do SO móvel quanto a apagamento seguro de memória (não há garantia forte aqui — ser honesto sobre isso). Nunca logar dados sensíveis.

## Senha mestra

Primeira execução: criação obrigatória, recomendação de frase-senha longa, medidor de força, aceitar espaços/colar, sem regras artificiais de composição, confirmação antes de criar o cofre, aviso de que a senha não é recuperável pela equipe. PIN curto não pode ser o único segredo criptográfico.

Argon2id com parâmetros adequados a celulares modernos — medir no dispositivo real na Fase 1 e documentar memória, iterações, paralelismo, tempo médio, e a justificativa da escolha. Atraso progressivo na UI após tentativas erradas. Sem exclusão automática do cofre (evitaria sabotagem intencional por terceiros). Documentar que o atraso de UI não protege contra ataque direto a uma cópia do arquivo — a proteção real ali é senha forte + Argon2id.

## Biometria

Conveniência, não substituto permanente. Quando ativada: Android Keystore / iOS Keychain-Secure Enclave, preferencialmente com chave respaldada por hardware, protegendo uma cópia da chave do cofre; nunca armazenar a senha mestra; exigir biometria para liberar a chave; invalidar ao mudar biometria cadastrada (quando a plataforma permitir); reexigir senha mestra periodicamente e após eventos de segurança relevantes; permitir desativar e apagar o material correspondente. Documentar o fluxo e suas limitações.

## Bloqueio e proteção visual

Bloqueio manual, imediato ao ir para segundo plano, por inatividade (tempo configurável), reautenticação ao retornar; ocultação em app recentes; bloqueio de screenshot no Android; overlay de privacidade no iOS; senhas ocultas por padrão com botão explícito para revelar, reocultando após curto período; proteção contra toque acidental; sem dados sensíveis em notificações. App sempre inicia bloqueado.

## Clipboard

Botões separados para copiar usuário e senha. Ao copiar senha: limpar automaticamente em até 30s (configurável para menos), avisar que outros apps podem observar o clipboard, nada em logs, sem cópias adicionais, limpar só o que o próprio app colocou (não apagar algo novo que o usuário tenha copiado depois).

## Gerador de senhas

RNG criptograficamente seguro, sem viés de módulo. Configurável: comprimento, maiúsculas, minúsculas, números, símbolos, exclusão de ambíguos, mínimo por grupo selecionado. Também gerador de frases-senha com wordlist documentada e incluída legalmente. Nunca logar senhas geradas.

## Backup e restauração

Backup sempre criptografado fora do app, com identificação de formato, versão, parâmetros criptográficos, salt, nonces, ciphertext e autenticação de integridade. Deve detectar senha errada e arquivo adulterado, evitar temporários em texto puro, ser restaurável em outro aparelho, nunca ser enviado automaticamente a nenhum serviço, e só ser compartilhado por ação explícita do usuário. Restauração valida o arquivo antes de substituir o cofre; cópia de segurança transacional antes da substituição, sem deixar conteúdo descriptografado em disco. Sem perguntas de segurança. Desativar/ajustar backups automáticos inseguros do SO (Android: `android:allowBackup` e regras de auto backup; documentar o equivalente previsto no iOS).

## Fora do MVP (todas as fases)

Sync na nuvem, armazenamento no GitHub, importação CSV, compartilhamento entre usuários, extensão de navegador, preenchimento automático, TOTP, anexos, recuperação por e-mail, servidor, painel administrativo. Documentar que TOTP e senha no mesmo cofre reduziriam a separação entre fatores de autenticação — por isso ficam de fora. Arquitetura deve deixar espaço para essas extensões futuras sem exigi-las agora.

## Interface

Telas: boas-vindas, criação da senha mestra, desbloqueio, lista do cofre, pesquisa, detalhes de credencial, criação/edição, gerador de senhas, categorias, configurações, backup/restauração, informações de segurança. Tema claro/escuro, responsivo, boa acessibilidade (leitor de tela, áreas de toque, não depender só de cor), linguagem simples, confirmação em ações destrutivas. Nenhuma senha/usuário real em telas de demonstração, testes ou capturas.

## Segurança do repositório

Repositório privado; branch principal protegida com revisão obrigatória antes de merge; Dependabot; análise estática; detecção de segredos; auditoria de dependências; permissões mínimas no GitHub Actions; actions de terceiros fixadas por hash de commit; política de reporte de vulnerabilidades. CI executa: formatação, análise estática, testes unitários e de integração viáveis, verificação de segredos, verificação de dependências, build de validação sem assinatura de produção. Sem segredos de assinatura no workflow.

`.gitignore` rigoroso cobrindo tudo do Flutter/Dart/Android/iOS mais qualquer formato de cofre, backup, exportação, temporário ou chave. `.env.example` só se necessário, com valores fictícios. Nunca versionar: senhas reais, senha mestra, chaves criptográficas, chave de recuperação, banco/arquivos do cofre, backups (mesmo criptografados), exportações, temporários, conteúdo descriptografado, `.env`, tokens, credenciais de API, certificados privados, keystores/chaves de assinatura Android/iOS, configurações pessoais.

Git/GitHub (repositório, Releases, LFS, Issues, Actions Artifacts, Packages, histórico de commits) nunca serve como armazenamento ou sync do cofre. Antes de qualquer commit: varrer por segredos, confirmar que nada sensível será versionado, rodar os testes, mostrar o que será adicionado, explicar qualquer arquivo que possa conter dados locais, e aguardar minha autorização antes de publicar.

## Testes obrigatórios (distribuídos pelas fases acima)

Derivação de chave; criação/abertura do cofre; criptografia/descriptografia; senha mestra errada; adulteração de ciphertext e de cabeçalho; unicidade de nonces; troca de senha mestra; biometria via abstrações testáveis; bloqueio por inatividade e ao ir para segundo plano; limpeza de clipboard; criação/restauração de backup e restauração de arquivo corrompido; migração de versão; gravação interrompida; gerador de senhas e validação de força; pesquisa; CRUD de credenciais; ausência de dados sensíveis em arquivos persistidos e em logs. Vetores de teste conhecidos onde aplicável; testar a integração e o formato de dados do app, não o funcionamento interno das bibliotecas criptográficas.

## Documentação obrigatória

`README.md` (requisitos, instalação, execução, testes, build Android, estrutura, funcionamento, cuidados de segurança, preparo do repositório privado), `SECURITY.md` (o que o app protege e o que não protege, modelo de ameaças, gerenciamento de chaves, biometria, backups, riscos de aparelho comprometido, processo de reporte, necessidade de auditoria independente), documento de arquitetura, documento do modelo de ameaças, especificação do formato criptografado, guia de desenvolvimento, guia de testes, checklist de auditoria, política de reporte de vulnerabilidades, plano de migração de formato, limitações conhecidas, funcionalidades futuras.

## Qualidade de código

Arquitetura simples, clara, testável, com separação entre interface, domínio, armazenamento, criptografia, autenticação, biometria, clipboard, backup e configurações. Injeção de dependências onde melhora testes. Erros tratados de forma segura e amigável. Sem código morto, funções vazias, TODOs críticos, segredos de exemplo, prints de depuração, implementações simuladas na versão final, ou dependências sem justificativa.

## Entrega ao final de cada fase

Resumo do que foi construído na fase; decisões técnicas tomadas; bibliotecas usadas e justificativa; caminhos dos arquivos importantes; comandos para rodar/testar; resultado dos testes e da análise estática; limitações conhecidas até este ponto; o que ainda depende de fases futuras. Ao final da Fase 6: instruções completas de build/release, orientação de assinatura sem expor chaves, instruções para criar o repositório privado, lista do que nunca deve ir ao GitHub, riscos pendentes, itens que exigem auditoria independente, checklist para teste em aparelho real. Sem publicar nada, sem `git push`, sem recursos externos, sem autorização explícita minha.
