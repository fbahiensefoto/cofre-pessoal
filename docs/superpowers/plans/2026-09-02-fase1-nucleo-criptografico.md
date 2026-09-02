# Fase 1 — Núcleo Criptográfico e Formato do Cofre — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir e testar, sem nenhuma UI, o núcleo que protege os dados do Cofre Pessoal — derivação de chave via Argon2id, envelope encryption da chave do cofre, criptografia autenticada dos dados via XChaCha20-Poly1305, formato de arquivo versionado, gravação atômica e recuperação de gravação interrompida.

**Architecture:** Camadas 100% Dart (`lib/core/crypto`, `lib/core/vault`, `lib/core/model`) sem dependência de widgets, testáveis via `flutter test` no host. `VaultKeyManager` implementa o envelope encryption (DEK protegida por KEK derivada da senha mestra); `VaultFormat`/`VaultHeader` definem a serialização binária; `VaultStorage` cuida da gravação atômica; `VaultRepository` orquestra tudo isso numa API de alto nível (create/open/changePassword).

**Tech Stack:** Flutter + Dart 3 (records, pattern matching), pacote `sodium: ^4.1.0` (bindings libsodium via FFI/native build hooks) para Argon2id e XChaCha20-Poly1305 IETF.

Referências: [docs/briefing-cofre-pessoal.md](../../briefing-cofre-pessoal.md), [docs/superpowers/specs/2026-09-02-fase1-nucleo-criptografico-design.md](../specs/2026-09-02-fase1-nucleo-criptografico-design.md).

## Global Constraints

- Dependência de cripto: **apenas** `sodium: ^4.1.0` no pubspec.yaml. Não adicionar `sodium_libs`/`sodium_libs_sumo` (deprecados, não são mais necessários desde a v4 do `sodium`).
- Requer Flutter `>=3.47.0` e Dart SDK `^3.13.0` (exigência do pacote `sodium`). Verificar antes de começar.
- Import para Argon2id: `package:sodium/sodium_sumo.dart` (classe `SodiumSumo`, via `SodiumSumoInit.init()`). O AEAD (`aeadXChaCha20Poly1305IETF`) também fica disponível por esse mesmo import.
- Algoritmo do Argon2id sempre explícito: `CryptoPwhashAlgorithm.argon2id13` — nunca usar `defaultAlg`.
- `minSdkVersion`/`minSdk` do Android = 26.
- Nenhuma chamada de rede, nenhuma dependência de armazenamento remoto.
- Mensagens de exceção em português, nunca incluindo senha, chave ou conteúdo decifrado.
- `SecureKey` sempre descartado com `.dispose()` assim que deixa de ser necessário; qualquer `Uint8List` extraído de um `SecureKey` via `.extractBytes()` é zerado manualmente (`fillRange(0, length, 0)`) depois de usado, já que não tem `dispose()` próprio.
- Formato binário do cofre (v1) exatamente como especificado no design: `magic(4) + formatVersion(2) + kdfMemLimit(4) + kdfOpsLimit(4) + salt(16) + wrapNonce(24) + wrapCiphertext(48) + dataNonce(24) + dataLength(4) + dataCiphertext(N)`, todos os inteiros multi-byte em big-endian.
- Critério de conclusão da fase: todos os testes passando via `flutter test`, `flutter analyze` sem avisos, relatório de entrega em `docs/fase1-entrega.md` com os tempos medidos do Argon2id.

---

### Task 1: Scaffold do projeto Flutter e inicialização do sodium

**Files:**
- Create: `pubspec.yaml` e estrutura padrão (via `flutter create`)
- Create: `lib/core/crypto/sodium_provider.dart`
- Create: `test/core/crypto/sodium_provider_test.dart`
- Modify: `android/app/build.gradle.kts` (ou `android/app/build.gradle` se o Flutter instalado ainda gerar Groovy)
- Modify: `.gitignore` (regenerado pelo `flutter create`, some ao `.gitignore` provisório atual)

**Interfaces:**
- Produces: `Future<SodiumSumo> initSodium()` — usado por toda tarefa seguinte que precisa de uma instância inicializada do sodium.

- [ ] **Step 1: Verificar a versão do Flutter instalado**

Run: `flutter --version`
Esperado: versão >= 3.47.0. Se for menor, atualizar o Flutter (`flutter upgrade`) antes de prosseguir — o pacote `sodium: ^4.1.0` depende dos native build hooks introduzidos nessa versão. Se `flutter pub get` mais adiante falhar mencionando "native assets"/"code assets" como recurso experimental, consultar a seção de instalação em https://github.com/Skycoder42/libsodium_dart_bindings/blob/main/packages/sodium/README.md.

- [ ] **Step 2: Criar o projeto Flutter no diretório atual**

Run: `flutter create --org com.cofrepessoal.app --project-name cofre_pessoal --platforms=android,ios .`

Isso preserva `docs/`, `.git/` e o `.gitignore` provisório será sobrescrito por um `.gitignore` padrão do Flutter — esperado e correto (o provisório já dizia que seria substituído aqui).

- [ ] **Step 3: Adicionar a dependência `sodium`**

Editar `pubspec.yaml`, dentro de `dependencies:`, adicionar:

```yaml
  sodium: ^4.1.0
```

Run: `flutter pub get`
Esperado: resolve sem erro.

- [ ] **Step 4: Definir minSdk = 26 no Android**

Abrir `android/app/build.gradle.kts`. Dentro do bloco `defaultConfig { ... }`, definir:

```kotlin
minSdk = 26
```

(Se o projeto gerado usar `android/app/build.gradle` em Groovy em vez de Kotlin DSL, o equivalente é `minSdkVersion 26` dentro do mesmo bloco `defaultConfig`.)

- [ ] **Step 5: Escrever o teste que falha**

Criar `test/core/crypto/sodium_provider_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:cofre_pessoal/core/crypto/sodium_provider.dart';

void main() {
  test('inicializa o SodiumSumo e expõe as constantes do AEAD XChaCha20-Poly1305', () async {
    final sodium = await initSodium();

    expect(sodium.crypto.aeadXChaCha20Poly1305IETF.keyBytes, 32);
    expect(sodium.crypto.aeadXChaCha20Poly1305IETF.nonceBytes, 24);
    expect(sodium.crypto.pwhash.saltBytes, 16);
  });
}
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `flutter test test/core/crypto/sodium_provider_test.dart`
Esperado: FAIL — `sodium_provider.dart` não existe / `initSodium` indefinido.

- [ ] **Step 7: Implementar `sodium_provider.dart`**

Criar `lib/core/crypto/sodium_provider.dart`:

```dart
import 'package:sodium/sodium_sumo.dart';

/// Inicializa o libsodium (variante "sumo", necessária para Argon2id).
/// Deve ser chamado uma única vez; instâncias de [SodiumSumo] são leves
/// de se manter em memória e podem ser injetadas nos demais componentes.
Future<SodiumSumo> initSodium() async {
  return SodiumSumoInit.init();
}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `flutter test test/core/crypto/sodium_provider_test.dart`
Esperado: PASS.

- [ ] **Step 9: Commit**

```bash
git add pubspec.yaml pubspec.lock android ios lib test .gitignore .metadata analysis_options.yaml
git commit -m "$(cat <<'EOF'
Scaffold Flutter project and wire up sodium initialization

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: KeyDerivation (Argon2id)

**Files:**
- Create: `lib/core/crypto/key_derivation.dart`
- Test: `test/core/crypto/key_derivation_test.dart`

**Interfaces:**
- Consumes: `Future<SodiumSumo> initSodium()` (Task 1).
- Produces: `class Argon2Params({required int opsLimit, required int memLimit})` com factory `Argon2Params.interactive(SodiumSumo sodium)`; `class KeyDerivation(SodiumSumo sodium)` com `int get saltBytes`, `Uint8List generateSalt()`, `SecureKey deriveKey({required String password, required Uint8List salt, required Argon2Params params, required int outLen})`. Usado pelas Tasks 6, 9.

- [ ] **Step 1: Escrever o teste do vetor conhecido do libsodium**

Este vetor vem da suíte de testes oficial do libsodium (`test/default/pwhash_argon2id.c`, tag `1.0.22-RELEASE`, caso de teste índice 6 — o mais rápido dos oito, `opslimit` no mínimo absoluto permitido). Verificado por duas fontes independentes (arquivo `.exp` oficial do libsodium e recomputação com `argon2-cffi`).

Criar `test/core/crypto/key_derivation_test.dart`:

```dart
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:sodium/sodium_sumo.dart';
import 'package:cofre_pessoal/core/crypto/key_derivation.dart';
import 'package:cofre_pessoal/core/crypto/sodium_provider.dart';

Uint8List hexToBytes(String hex) {
  final result = Uint8List(hex.length ~/ 2);
  for (var i = 0; i < result.length; i++) {
    result[i] = int.parse(hex.substring(i * 2, i * 2 + 2), radix: 16);
  }
  return result;
}

void main() {
  late SodiumSumo sodium;

  setUpAll(() async {
    sodium = await initSodium();
  });

  test('vetor conhecido do libsodium (crypto_pwhash, Argon2id13, opslimit mínimo)', () {
    final password = hexToBytes(
      'b540beb016a5366524d4605156493f9874514a5aa58818cd0c6dfffaa9e90205f17b',
    );
    final salt = hexToBytes('44071f6d181561670bda728d43fb79b');
    const expectedHex =
        '7fb72409b0987f8190c3729710e98c3f80c5a8727d425fdcde7f3644d467fe973f5b5fee'
        '683bd3fce812cb9ae5e9921a2d06c2f1905e4e839692f2b934b682f11a2fe2b90482ea5dd'
        '234863516dba6f52dc0702d324ec77d860c2e181f84472bd7104fedce071ffa93c530949'
        '4ad51623d214447a7b2b1462dc7d5d55a1f6fd5b54ce024118d86f0c6489d16545aaa87b'
        '6689dad9f2fb47fda9894f8e12b87d978b483ccd4cc5fd9595cdc7a818452f915ce2f7d'
        'f95ec12b1c72e3788d473441d884f9748eb14703c21b45d82fd667b85f5b2d98c13303b'
        '3fe76285531a826b6fc0fe8e3dddecf';

    final derived = sodium.crypto.pwhash.callRaw(
      outLen: 231,
      password: Int8List.fromList(password),
      salt: salt,
      opsLimit: 1,
      memLimit: 1631659,
      alg: CryptoPwhashAlgorithm.argon2id13,
    );

    final derivedBytes = derived.extractBytes();
    expect(derivedBytes, hexToBytes(expectedHex));
    derivedBytes.fillRange(0, derivedBytes.length, 0);
    derived.dispose();
  });

  test('KeyDerivation.deriveKey é determinística para as mesmas entradas', () {
    final kdf = KeyDerivation(sodium);
    final salt = kdf.generateSalt();
    final params = Argon2Params.interactive(sodium);

    final key1 = kdf.deriveKey(
      password: 'frase-senha-fictícia',
      salt: salt,
      params: params,
      outLen: 32,
    );
    final key2 = kdf.deriveKey(
      password: 'frase-senha-fictícia',
      salt: salt,
      params: params,
      outLen: 32,
    );

    final bytes1 = key1.extractBytes();
    final bytes2 = key2.extractBytes();
    expect(bytes1, bytes2);

    bytes1.fillRange(0, bytes1.length, 0);
    bytes2.fillRange(0, bytes2.length, 0);
    key1.dispose();
    key2.dispose();
  });

  test('KeyDerivation.deriveKey produz saída diferente para salts diferentes', () {
    final kdf = KeyDerivation(sodium);
    final params = Argon2Params.interactive(sodium);

    final key1 = kdf.deriveKey(
      password: 'frase-senha-fictícia',
      salt: kdf.generateSalt(),
      params: params,
      outLen: 32,
    );
    final key2 = kdf.deriveKey(
      password: 'frase-senha-fictícia',
      salt: kdf.generateSalt(),
      params: params,
      outLen: 32,
    );

    final bytes1 = key1.extractBytes();
    final bytes2 = key2.extractBytes();
    expect(bytes1, isNot(equals(bytes2)));

    bytes1.fillRange(0, bytes1.length, 0);
    bytes2.fillRange(0, bytes2.length, 0);
    key1.dispose();
    key2.dispose();
  });

  test('KeyDerivation.generateSalt gera valores de tamanho correto e distintos', () {
    final kdf = KeyDerivation(sodium);
    final salt1 = kdf.generateSalt();
    final salt2 = kdf.generateSalt();

    expect(salt1.length, kdf.saltBytes);
    expect(salt1, isNot(equals(salt2)));
  });
}
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `flutter test test/core/crypto/key_derivation_test.dart`
Esperado: FAIL — `key_derivation.dart` não existe.

- [ ] **Step 3: Implementar `key_derivation.dart`**

Criar `lib/core/crypto/key_derivation.dart`:

```dart
import 'dart:typed_data';

import 'package:sodium/sodium_sumo.dart';

class Argon2Params {
  final int opsLimit;
  final int memLimit;

  const Argon2Params({required this.opsLimit, required this.memLimit});

  /// Preset conservador (64 MiB / 2 iterações) usado como baseline provisório
  /// nesta fase. Precisa ser revalidado com benchmark em dispositivo Android
  /// real antes de qualquer uso além de testes — ver docs/fase1-entrega.md.
  factory Argon2Params.interactive(SodiumSumo sodium) => Argon2Params(
        opsLimit: sodium.crypto.pwhash.opsLimitInteractive,
        memLimit: sodium.crypto.pwhash.memLimitInteractive,
      );
}

class KeyDerivation {
  final SodiumSumo _sodium;

  const KeyDerivation(this._sodium);

  int get saltBytes => _sodium.crypto.pwhash.saltBytes;

  Uint8List generateSalt() => _sodium.randombytes.buf(saltBytes);

  SecureKey deriveKey({
    required String password,
    required Uint8List salt,
    required Argon2Params params,
    required int outLen,
  }) {
    return _sodium.crypto.pwhash.callStr(
      outLen: outLen,
      password: password,
      salt: salt,
      opsLimit: params.opsLimit,
      memLimit: params.memLimit,
      alg: CryptoPwhashAlgorithm.argon2id13,
    );
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `flutter test test/core/crypto/key_derivation_test.dart`
Esperado: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/core/crypto/key_derivation.dart test/core/crypto/key_derivation_test.dart
git commit -m "$(cat <<'EOF'
Add Argon2id key derivation wrapper with libsodium known-answer test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: AeadCipher (XChaCha20-Poly1305)

**Files:**
- Create: `lib/core/crypto/aead_cipher.dart`
- Test: `test/core/crypto/aead_cipher_test.dart`

**Interfaces:**
- Consumes: `Future<SodiumSumo> initSodium()` (Task 1).
- Produces: `class AeadCipher(SodiumSumo sodium)` com `int get keyBytes`, `int get nonceBytes`, `Uint8List generateNonce()`, `Uint8List encrypt({required Uint8List message, required Uint8List nonce, required SecureKey key, Uint8List? additionalData})`, `Uint8List decrypt({required Uint8List cipherText, required Uint8List nonce, required SecureKey key, Uint8List? additionalData})`. Usado pelas Tasks 6, 9.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/crypto/aead_cipher_test.dart`:

```dart
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:sodium/sodium_sumo.dart';
import 'package:cofre_pessoal/core/crypto/aead_cipher.dart';
import 'package:cofre_pessoal/core/crypto/sodium_provider.dart';

void main() {
  late SodiumSumo sodium;
  late AeadCipher aead;

  setUpAll(() async {
    sodium = await initSodium();
    aead = AeadCipher(sodium);
  });

  test('round-trip: decifrar o que foi cifrado devolve a mensagem original', () {
    final key = sodium.secureRandom(aead.keyBytes);
    final nonce = aead.generateNonce();
    final message = Uint8List.fromList(utf8.encode('credencial fictícia de teste'));

    final cipherText = aead.encrypt(message: message, nonce: nonce, key: key);
    final plainText = aead.decrypt(cipherText: cipherText, nonce: nonce, key: key);

    expect(plainText, message);
    key.dispose();
  });

  test('round-trip com dados associados (AAD) confere e detecta troca de AAD', () {
    final key = sodium.secureRandom(aead.keyBytes);
    final nonce = aead.generateNonce();
    final message = Uint8List.fromList(utf8.encode('credencial fictícia de teste'));
    final aad = Uint8List.fromList(utf8.encode('cabecalho-v1'));
    final aadTrocado = Uint8List.fromList(utf8.encode('cabecalho-v2'));

    final cipherText = aead.encrypt(
      message: message,
      nonce: nonce,
      key: key,
      additionalData: aad,
    );

    final plainText = aead.decrypt(
      cipherText: cipherText,
      nonce: nonce,
      key: key,
      additionalData: aad,
    );
    expect(plainText, message);

    expect(
      () => aead.decrypt(
        cipherText: cipherText,
        nonce: nonce,
        key: key,
        additionalData: aadTrocado,
      ),
      throwsException,
    );
    key.dispose();
  });

  test('adulterar um byte do ciphertext faz a decifração falhar', () {
    final key = sodium.secureRandom(aead.keyBytes);
    final nonce = aead.generateNonce();
    final message = Uint8List.fromList(utf8.encode('credencial fictícia de teste'));

    final cipherText = aead.encrypt(message: message, nonce: nonce, key: key);
    final adulterado = Uint8List.fromList(cipherText);
    adulterado[0] ^= 0xFF;

    expect(
      () => aead.decrypt(cipherText: adulterado, nonce: nonce, key: key),
      throwsException,
    );
    key.dispose();
  });

  test('decifrar com o nonce errado falha', () {
    final key = sodium.secureRandom(aead.keyBytes);
    final nonce = aead.generateNonce();
    final outroNonce = aead.generateNonce();
    final message = Uint8List.fromList(utf8.encode('credencial fictícia de teste'));

    final cipherText = aead.encrypt(message: message, nonce: nonce, key: key);

    expect(
      () => aead.decrypt(cipherText: cipherText, nonce: outroNonce, key: key),
      throwsException,
    );
    key.dispose();
  });

  test('unicidade estatística dos nonces gerados', () {
    final nonces = List.generate(1000, (_) => aead.generateNonce());
    final unicos = nonces.map((n) => base64Encode(n)).toSet();
    expect(unicos.length, nonces.length);
  });
}
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `flutter test test/core/crypto/aead_cipher_test.dart`
Esperado: FAIL — `aead_cipher.dart` não existe.

- [ ] **Step 3: Implementar `aead_cipher.dart`**

Criar `lib/core/crypto/aead_cipher.dart`:

```dart
import 'dart:typed_data';

import 'package:sodium/sodium_sumo.dart';

class AeadCipher {
  final SodiumSumo _sodium;

  const AeadCipher(this._sodium);

  int get keyBytes => _sodium.crypto.aeadXChaCha20Poly1305IETF.keyBytes;
  int get nonceBytes => _sodium.crypto.aeadXChaCha20Poly1305IETF.nonceBytes;

  Uint8List generateNonce() => _sodium.randombytes.buf(nonceBytes);

  Uint8List encrypt({
    required Uint8List message,
    required Uint8List nonce,
    required SecureKey key,
    Uint8List? additionalData,
  }) {
    return _sodium.crypto.aeadXChaCha20Poly1305IETF.encrypt(
      message: message,
      nonce: nonce,
      key: key,
      additionalData: additionalData,
    );
  }

  Uint8List decrypt({
    required Uint8List cipherText,
    required Uint8List nonce,
    required SecureKey key,
    Uint8List? additionalData,
  }) {
    return _sodium.crypto.aeadXChaCha20Poly1305IETF.decrypt(
      cipherText: cipherText,
      nonce: nonce,
      key: key,
      additionalData: additionalData,
    );
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `flutter test test/core/crypto/aead_cipher_test.dart`
Esperado: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/core/crypto/aead_cipher.dart test/core/crypto/aead_cipher_test.dart
git commit -m "$(cat <<'EOF'
Add XChaCha20-Poly1305 AEAD wrapper with tamper and nonce-uniqueness tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Exceções de domínio e VaultHeader

**Files:**
- Create: `lib/core/vault/vault_exceptions.dart`
- Create: `lib/core/vault/vault_header.dart`
- Test: `test/core/vault/vault_header_test.dart`

**Interfaces:**
- Produces: `class VaultNotFoundException implements Exception`, `class VaultUnsupportedVersionException implements Exception { final int foundVersion; }`, `class VaultCorruptHeaderException implements Exception { final String reason; }`, `class VaultAuthenticationFailedException implements Exception`; `class VaultHeader({required int formatVersion, required int kdfMemLimit, required int kdfOpsLimit, required Uint8List salt})` com `static const headerLength = 30`, `static const currentVersion = 1`, `Uint8List toBytes()`, `Uint8List get dataAad`, `static VaultHeader fromBytes(Uint8List bytes)`. Usado pelas Tasks 6, 7, 9.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vault_header_test.dart`:

```dart
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:cofre_pessoal/core/vault/vault_exceptions.dart';
import 'package:cofre_pessoal/core/vault/vault_header.dart';

void main() {
  VaultHeader sampleHeader() => VaultHeader(
        formatVersion: VaultHeader.currentVersion,
        kdfMemLimit: 67108864,
        kdfOpsLimit: 2,
        salt: Uint8List.fromList(List.generate(16, (i) => i)),
      );

  test('round-trip: fromBytes(toBytes()) preserva todos os campos', () {
    final header = sampleHeader();
    final parsed = VaultHeader.fromBytes(header.toBytes());

    expect(parsed.formatVersion, header.formatVersion);
    expect(parsed.kdfMemLimit, header.kdfMemLimit);
    expect(parsed.kdfOpsLimit, header.kdfOpsLimit);
    expect(parsed.salt, header.salt);
  });

  test('toBytes() produz exatamente headerLength bytes', () {
    expect(sampleHeader().toBytes().length, VaultHeader.headerLength);
  });

  test('dataAad contém só magic + versão (6 bytes), estável entre cabeçalhos com salts diferentes', () {
    final header1 = sampleHeader();
    final header2 = VaultHeader(
      formatVersion: VaultHeader.currentVersion,
      kdfMemLimit: 999999,
      kdfOpsLimit: 9,
      salt: Uint8List.fromList(List.generate(16, (i) => 255 - i)),
    );

    expect(header1.dataAad.length, 6);
    expect(header1.dataAad, header2.dataAad);
  });

  test('fromBytes rejeita magic inválido', () {
    final bytes = sampleHeader().toBytes();
    bytes[0] = 0x00;

    expect(() => VaultHeader.fromBytes(bytes), throwsA(isA<VaultCorruptHeaderException>()));
  });

  test('fromBytes rejeita bytes truncados', () {
    final bytes = sampleHeader().toBytes();
    final truncado = bytes.sublist(0, VaultHeader.headerLength - 1);

    expect(() => VaultHeader.fromBytes(truncado), throwsA(isA<VaultCorruptHeaderException>()));
  });
}
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `flutter test test/core/vault/vault_header_test.dart`
Esperado: FAIL — `vault_header.dart`/`vault_exceptions.dart` não existem.

- [ ] **Step 3: Implementar `vault_exceptions.dart`**

Criar `lib/core/vault/vault_exceptions.dart`:

```dart
class VaultNotFoundException implements Exception {
  const VaultNotFoundException();

  @override
  String toString() => 'Nenhum cofre encontrado neste caminho.';
}

class VaultUnsupportedVersionException implements Exception {
  final int foundVersion;

  const VaultUnsupportedVersionException(this.foundVersion);

  @override
  String toString() => 'Versão de formato do cofre não suportada: $foundVersion.';
}

class VaultCorruptHeaderException implements Exception {
  final String reason;

  const VaultCorruptHeaderException(this.reason);

  @override
  String toString() => 'Cabeçalho do cofre inválido: $reason';
}

class VaultAuthenticationFailedException implements Exception {
  const VaultAuthenticationFailedException();

  @override
  String toString() => 'Senha incorreta ou arquivo corrompido.';
}
```

- [ ] **Step 4: Implementar `vault_header.dart`**

Criar `lib/core/vault/vault_header.dart`:

```dart
import 'dart:typed_data';

import 'vault_exceptions.dart';

class VaultHeader {
  static const magicBytes = [0x43, 0x50, 0x56, 0x31]; // "CPV1"
  static const currentVersion = 1;
  static const headerLength = 4 + 2 + 4 + 4 + 16; // 30 bytes

  final int formatVersion;
  final int kdfMemLimit;
  final int kdfOpsLimit;
  final Uint8List salt;

  const VaultHeader({
    required this.formatVersion,
    required this.kdfMemLimit,
    required this.kdfOpsLimit,
    required this.salt,
  });

  /// Bytes completos do cabeçalho — usados como AAD ao embrulhar a DEK,
  /// para impedir downgrade de parâmetros do Argon2id sem invalidar a MAC.
  Uint8List toBytes() {
    final result = Uint8List(headerLength);
    final view = ByteData.sublistView(result);
    result.setRange(0, 4, magicBytes);
    view.setUint16(4, formatVersion, Endian.big);
    view.setUint32(6, kdfMemLimit, Endian.big);
    view.setUint32(10, kdfOpsLimit, Endian.big);
    result.setRange(14, 30, salt);
    return result;
  }

  /// AAD usado para a seção de dados — deliberadamente não inclui salt/params,
  /// para que trocar a senha mestra não exija recriptografar os dados.
  Uint8List get dataAad {
    final result = Uint8List(6);
    result.setRange(0, 4, magicBytes);
    ByteData.sublistView(result).setUint16(4, formatVersion, Endian.big);
    return result;
  }

  static VaultHeader fromBytes(Uint8List bytes) {
    if (bytes.length < headerLength) {
      throw const VaultCorruptHeaderException('Cabeçalho truncado.');
    }
    for (var i = 0; i < magicBytes.length; i++) {
      if (bytes[i] != magicBytes[i]) {
        throw const VaultCorruptHeaderException('Assinatura do arquivo inválida.');
      }
    }
    final view = ByteData.sublistView(bytes, 0, headerLength);
    final formatVersion = view.getUint16(4, Endian.big);
    final kdfMemLimit = view.getUint32(6, Endian.big);
    final kdfOpsLimit = view.getUint32(10, Endian.big);
    final salt = Uint8List.fromList(bytes.sublist(14, 30));

    return VaultHeader(
      formatVersion: formatVersion,
      kdfMemLimit: kdfMemLimit,
      kdfOpsLimit: kdfOpsLimit,
      salt: salt,
    );
  }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `flutter test test/core/vault/vault_header_test.dart`
Esperado: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add lib/core/vault/vault_exceptions.dart lib/core/vault/vault_header.dart test/core/vault/vault_header_test.dart
git commit -m "$(cat <<'EOF'
Add vault domain exceptions and versioned header serialization

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Modelo Credential

**Files:**
- Create: `lib/core/model/credential.dart`
- Test: `test/core/model/credential_test.dart`

**Interfaces:**
- Produces: `class Credential({required String id, required String serviceName, required String category, String? url, String? username, required String password, String? notes, List<String> tags = const [], bool favorite = false, required DateTime createdAt, required DateTime updatedAt})` com `Map<String, dynamic> toJson()` e `static Credential fromJson(Map<String, dynamic> json)`. Usado pela Task 9.

- [ ] **Step 1: Escrever o teste**

Criar `test/core/model/credential_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:cofre_pessoal/core/model/credential.dart';

void main() {
  test('round-trip: fromJson(toJson()) preserva todos os campos', () {
    final original = Credential(
      id: 'id-ficticio-001',
      serviceName: 'Serviço Fictício',
      category: 'e-mail',
      url: 'https://exemplo.invalido',
      username: 'usuario.ficticio@exemplo.invalido',
      password: 'senha-ficticia-de-teste',
      notes: 'observação de teste',
      tags: const ['pessoal', 'teste'],
      favorite: true,
      createdAt: DateTime.utc(2026, 1, 1),
      updatedAt: DateTime.utc(2026, 1, 2),
    );

    final restored = Credential.fromJson(original.toJson());

    expect(restored.id, original.id);
    expect(restored.serviceName, original.serviceName);
    expect(restored.category, original.category);
    expect(restored.url, original.url);
    expect(restored.username, original.username);
    expect(restored.password, original.password);
    expect(restored.notes, original.notes);
    expect(restored.tags, original.tags);
    expect(restored.favorite, original.favorite);
    expect(restored.createdAt, original.createdAt);
    expect(restored.updatedAt, original.updatedAt);
  });

  test('campos opcionais podem ser nulos e tags/favorite têm padrão', () {
    final credential = Credential(
      id: 'id-ficticio-002',
      serviceName: 'Outro Serviço Fictício',
      category: 'site',
      password: 'outra-senha-ficticia',
      createdAt: DateTime.utc(2026, 1, 1),
      updatedAt: DateTime.utc(2026, 1, 1),
    );

    expect(credential.url, isNull);
    expect(credential.username, isNull);
    expect(credential.notes, isNull);
    expect(credential.tags, isEmpty);
    expect(credential.favorite, isFalse);

    final restored = Credential.fromJson(credential.toJson());
    expect(restored.url, isNull);
    expect(restored.tags, isEmpty);
  });
}
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `flutter test test/core/model/credential_test.dart`
Esperado: FAIL — `credential.dart` não existe.

- [ ] **Step 3: Implementar `credential.dart`**

Criar `lib/core/model/credential.dart`:

```dart
class Credential {
  final String id;
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

  const Credential({
    required this.id,
    required this.serviceName,
    required this.category,
    this.url,
    this.username,
    required this.password,
    this.notes,
    this.tags = const [],
    this.favorite = false,
    required this.createdAt,
    required this.updatedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'serviceName': serviceName,
        'category': category,
        'url': url,
        'username': username,
        'password': password,
        'notes': notes,
        'tags': tags,
        'favorite': favorite,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };

  static Credential fromJson(Map<String, dynamic> json) => Credential(
        id: json['id'] as String,
        serviceName: json['serviceName'] as String,
        category: json['category'] as String,
        url: json['url'] as String?,
        username: json['username'] as String?,
        password: json['password'] as String,
        notes: json['notes'] as String?,
        tags: (json['tags'] as List<dynamic>).map((e) => e as String).toList(),
        favorite: json['favorite'] as bool,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `flutter test test/core/model/credential_test.dart`
Esperado: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/core/model/credential.dart test/core/model/credential_test.dart
git commit -m "$(cat <<'EOF'
Add Credential domain model with JSON round-trip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: VaultKeyManager (envelope encryption da DEK)

**Files:**
- Create: `lib/core/vault/vault_key_manager.dart`
- Test: `test/core/vault/vault_key_manager_test.dart`

**Interfaces:**
- Consumes: `KeyDerivation`, `Argon2Params` (Task 2); `AeadCipher` (Task 3); `VaultHeader` (Task 4).
- Produces: `class WrappedDek({required Uint8List nonce, required Uint8List ciphertext})`; `class VaultKeyManager(SodiumSumo sodium)` com `SecureKey generateDek()`, `({VaultHeader header, WrappedDek wrapped}) wrapNewDek({required SecureKey dek, required String masterPassword, required Argon2Params params})`, `SecureKey unwrapDek({required VaultHeader header, required WrappedDek wrapped, required String masterPassword})`, `({VaultHeader header, WrappedDek wrapped}) rewrapDek({required SecureKey dek, required String newMasterPassword, required Argon2Params params})`. Usado pela Task 9.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vault_key_manager_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:sodium/sodium_sumo.dart';
import 'package:cofre_pessoal/core/crypto/key_derivation.dart';
import 'package:cofre_pessoal/core/crypto/sodium_provider.dart';
import 'package:cofre_pessoal/core/vault/vault_exceptions.dart';
import 'package:cofre_pessoal/core/vault/vault_header.dart';
import 'package:cofre_pessoal/core/vault/vault_key_manager.dart';

void main() {
  late SodiumSumo sodium;
  late VaultKeyManager keyManager;
  late Argon2Params params;

  setUpAll(() async {
    sodium = await initSodium();
    keyManager = VaultKeyManager(sodium);
    params = Argon2Params.interactive(sodium);
  });

  test('wrapNewDek + unwrapDek com a senha correta devolve a mesma DEK', () {
    final dek = keyManager.generateDek();
    final dekBytesOriginais = dek.extractBytes();

    final result = keyManager.wrapNewDek(
      dek: dek,
      masterPassword: 'frase-senha-ficticia-forte',
      params: params,
    );
    dek.dispose();

    final dekDesembrulhada = keyManager.unwrapDek(
      header: result.header,
      wrapped: result.wrapped,
      masterPassword: 'frase-senha-ficticia-forte',
    );
    final dekBytesDesembrulhados = dekDesembrulhada.extractBytes();

    expect(dekBytesDesembrulhados, dekBytesOriginais);

    dekBytesOriginais.fillRange(0, dekBytesOriginais.length, 0);
    dekBytesDesembrulhados.fillRange(0, dekBytesDesembrulhados.length, 0);
    dekDesembrulhada.dispose();
  });

  test('unwrapDek com a senha errada lança VaultAuthenticationFailedException', () {
    final dek = keyManager.generateDek();
    final result = keyManager.wrapNewDek(
      dek: dek,
      masterPassword: 'senha-correta-ficticia',
      params: params,
    );
    dek.dispose();

    expect(
      () => keyManager.unwrapDek(
        header: result.header,
        wrapped: result.wrapped,
        masterPassword: 'senha-errada-ficticia',
      ),
      throwsA(isA<VaultAuthenticationFailedException>()),
    );
  });

  test('adulterar o salt do cabeçalho invalida a chave embrulhada (bloqueia downgrade)', () {
    final dek = keyManager.generateDek();
    final result = keyManager.wrapNewDek(
      dek: dek,
      masterPassword: 'senha-correta-ficticia',
      params: params,
    );
    dek.dispose();

    final saltAdulterado = result.header.salt.sublist(0);
    saltAdulterado[0] ^= 0xFF;
    final headerAdulterado = VaultHeader(
      formatVersion: result.header.formatVersion,
      kdfMemLimit: result.header.kdfMemLimit,
      kdfOpsLimit: result.header.kdfOpsLimit,
      salt: saltAdulterado,
    );

    expect(
      () => keyManager.unwrapDek(
        header: headerAdulterado,
        wrapped: result.wrapped,
        masterPassword: 'senha-correta-ficticia',
      ),
      throwsA(isA<VaultAuthenticationFailedException>()),
    );
  });

  test('rewrapDek com nova senha invalida a senha antiga e a nova funciona', () {
    final dek = keyManager.generateDek();
    final dekBytesOriginais = dek.extractBytes();

    final wrapped1 = keyManager.wrapNewDek(
      dek: dek,
      masterPassword: 'senha-antiga-ficticia',
      params: params,
    );

    final wrapped2 = keyManager.rewrapDek(
      dek: dek,
      newMasterPassword: 'senha-nova-ficticia',
      params: params,
    );
    dek.dispose();

    expect(
      () => keyManager.unwrapDek(
        header: wrapped2.header,
        wrapped: wrapped2.wrapped,
        masterPassword: 'senha-antiga-ficticia',
      ),
      throwsA(isA<VaultAuthenticationFailedException>()),
    );

    final dekReaberta = keyManager.unwrapDek(
      header: wrapped2.header,
      wrapped: wrapped2.wrapped,
      masterPassword: 'senha-nova-ficticia',
    );
    final dekBytesReabertos = dekReaberta.extractBytes();
    expect(dekBytesReabertos, dekBytesOriginais);

    dekBytesOriginais.fillRange(0, dekBytesOriginais.length, 0);
    dekBytesReabertos.fillRange(0, dekBytesReabertos.length, 0);
    dekReaberta.dispose();
  });
}
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `flutter test test/core/vault/vault_key_manager_test.dart`
Esperado: FAIL — `vault_key_manager.dart` não existe.

- [ ] **Step 3: Implementar `vault_key_manager.dart`**

Criar `lib/core/vault/vault_key_manager.dart`:

```dart
import 'dart:typed_data';

import 'package:sodium/sodium_sumo.dart';

import '../crypto/aead_cipher.dart';
import '../crypto/key_derivation.dart';
import 'vault_exceptions.dart';
import 'vault_header.dart';

class WrappedDek {
  final Uint8List nonce;
  final Uint8List ciphertext;

  const WrappedDek({required this.nonce, required this.ciphertext});
}

class VaultKeyManager {
  final SodiumSumo _sodium;
  final KeyDerivation _keyDerivation;
  final AeadCipher _aead;

  VaultKeyManager(this._sodium)
      : _keyDerivation = KeyDerivation(_sodium),
        _aead = AeadCipher(_sodium);

  SecureKey generateDek() => _sodium.secureRandom(_aead.keyBytes);

  ({VaultHeader header, WrappedDek wrapped}) wrapNewDek({
    required SecureKey dek,
    required String masterPassword,
    required Argon2Params params,
  }) {
    final salt = _keyDerivation.generateSalt();
    final header = VaultHeader(
      formatVersion: VaultHeader.currentVersion,
      kdfMemLimit: params.memLimit,
      kdfOpsLimit: params.opsLimit,
      salt: salt,
    );

    final kek = _keyDerivation.deriveKey(
      password: masterPassword,
      salt: salt,
      params: params,
      outLen: _aead.keyBytes,
    );

    final nonce = _aead.generateNonce();
    final dekBytes = dek.extractBytes();
    final ciphertext = _aead.encrypt(
      message: dekBytes,
      nonce: nonce,
      key: kek,
      additionalData: header.toBytes(),
    );
    dekBytes.fillRange(0, dekBytes.length, 0);
    kek.dispose();

    return (header: header, wrapped: WrappedDek(nonce: nonce, ciphertext: ciphertext));
  }

  SecureKey unwrapDek({
    required VaultHeader header,
    required WrappedDek wrapped,
    required String masterPassword,
  }) {
    final params = Argon2Params(opsLimit: header.kdfOpsLimit, memLimit: header.kdfMemLimit);
    final kek = _keyDerivation.deriveKey(
      password: masterPassword,
      salt: header.salt,
      params: params,
      outLen: _aead.keyBytes,
    );

    try {
      final dekBytes = _aead.decrypt(
        cipherText: wrapped.ciphertext,
        nonce: wrapped.nonce,
        key: kek,
        additionalData: header.toBytes(),
      );
      final dek = _sodium.secureCopy(dekBytes);
      dekBytes.fillRange(0, dekBytes.length, 0);
      return dek;
    } on Exception {
      throw const VaultAuthenticationFailedException();
    } finally {
      kek.dispose();
    }
  }

  ({VaultHeader header, WrappedDek wrapped}) rewrapDek({
    required SecureKey dek,
    required String newMasterPassword,
    required Argon2Params params,
  }) {
    return wrapNewDek(dek: dek, masterPassword: newMasterPassword, params: params);
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `flutter test test/core/vault/vault_key_manager_test.dart`
Esperado: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/core/vault/vault_key_manager.dart test/core/vault/vault_key_manager_test.dart
git commit -m "$(cat <<'EOF'
Add VaultKeyManager implementing DEK envelope encryption and rewrap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: VaultFormat (serialização binária completa do arquivo)

**Files:**
- Create: `lib/core/vault/vault_format.dart`
- Test: `test/core/vault/vault_format_test.dart`

**Interfaces:**
- Consumes: `VaultHeader` (Task 4), `WrappedDek` (Task 6).
- Produces: `class VaultFile({required VaultHeader header, required WrappedDek wrappedDek, required Uint8List dataNonce, required Uint8List dataCiphertext})` com `Uint8List toBytes()` e `static VaultFile fromBytes(Uint8List bytes)`. Usado pela Task 9.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vault_format_test.dart`:

```dart
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:cofre_pessoal/core/vault/vault_exceptions.dart';
import 'package:cofre_pessoal/core/vault/vault_format.dart';
import 'package:cofre_pessoal/core/vault/vault_header.dart';
import 'package:cofre_pessoal/core/vault/vault_key_manager.dart';

void main() {
  VaultFile sampleFile() => VaultFile(
        header: VaultHeader(
          formatVersion: VaultHeader.currentVersion,
          kdfMemLimit: 67108864,
          kdfOpsLimit: 2,
          salt: Uint8List.fromList(List.generate(16, (i) => i)),
        ),
        wrappedDek: WrappedDek(
          nonce: Uint8List.fromList(List.generate(24, (i) => i)),
          ciphertext: Uint8List.fromList(List.generate(48, (i) => 255 - i)),
        ),
        dataNonce: Uint8List.fromList(List.generate(24, (i) => 24 - i)),
        dataCiphertext: Uint8List.fromList(List.generate(100, (i) => i % 256)),
      );

  test('round-trip: fromBytes(toBytes()) preserva todas as seções', () {
    final file = sampleFile();
    final parsed = VaultFile.fromBytes(file.toBytes());

    expect(parsed.header.formatVersion, file.header.formatVersion);
    expect(parsed.header.kdfMemLimit, file.header.kdfMemLimit);
    expect(parsed.header.kdfOpsLimit, file.header.kdfOpsLimit);
    expect(parsed.header.salt, file.header.salt);
    expect(parsed.wrappedDek.nonce, file.wrappedDek.nonce);
    expect(parsed.wrappedDek.ciphertext, file.wrappedDek.ciphertext);
    expect(parsed.dataNonce, file.dataNonce);
    expect(parsed.dataCiphertext, file.dataCiphertext);
  });

  test('funciona com dataCiphertext vazio (cofre recém-criado, sem credenciais)', () {
    final file = VaultFile(
      header: sampleFile().header,
      wrappedDek: sampleFile().wrappedDek,
      dataNonce: sampleFile().dataNonce,
      dataCiphertext: Uint8List(0),
    );
    final parsed = VaultFile.fromBytes(file.toBytes());
    expect(parsed.dataCiphertext, isEmpty);
  });

  test('fromBytes rejeita arquivo truncado na seção de chave', () {
    final bytes = sampleFile().toBytes();
    final truncado = bytes.sublist(0, VaultHeader.headerLength + 10);

    expect(() => VaultFile.fromBytes(truncado), throwsA(isA<VaultCorruptHeaderException>()));
  });

  test('fromBytes rejeita arquivo truncado na seção de dados', () {
    final bytes = sampleFile().toBytes();
    final truncado = bytes.sublist(0, bytes.length - 10);

    expect(() => VaultFile.fromBytes(truncado), throwsA(isA<VaultCorruptHeaderException>()));
  });
}
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `flutter test test/core/vault/vault_format_test.dart`
Esperado: FAIL — `vault_format.dart` não existe.

- [ ] **Step 3: Implementar `vault_format.dart`**

Criar `lib/core/vault/vault_format.dart`:

```dart
import 'dart:typed_data';

import 'vault_exceptions.dart';
import 'vault_header.dart';
import 'vault_key_manager.dart';

class VaultFile {
  static const wrapNonceLength = 24; // crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
  static const wrapCiphertextLength = 48; // DEK (32B) + tag Poly1305 (16B)
  static const dataNonceLength = 24;
  static const dataLengthFieldSize = 4;

  final VaultHeader header;
  final WrappedDek wrappedDek;
  final Uint8List dataNonce;
  final Uint8List dataCiphertext;

  const VaultFile({
    required this.header,
    required this.wrappedDek,
    required this.dataNonce,
    required this.dataCiphertext,
  });

  Uint8List toBytes() {
    final headerBytes = header.toBytes();
    final dataLengthBytes = Uint8List(dataLengthFieldSize);
    ByteData.sublistView(dataLengthBytes).setUint32(0, dataCiphertext.length, Endian.big);

    final builder = BytesBuilder();
    builder.add(headerBytes);
    builder.add(wrappedDek.nonce);
    builder.add(wrappedDek.ciphertext);
    builder.add(dataNonce);
    builder.add(dataLengthBytes);
    builder.add(dataCiphertext);
    return builder.toBytes();
  }

  static VaultFile fromBytes(Uint8List bytes) {
    var offset = VaultHeader.headerLength;
    if (bytes.length < offset) {
      throw const VaultCorruptHeaderException('Cabeçalho truncado.');
    }
    final header = VaultHeader.fromBytes(bytes.sublist(0, offset));

    if (bytes.length < offset + wrapNonceLength + wrapCiphertextLength) {
      throw const VaultCorruptHeaderException('Seção de chave embrulhada truncada.');
    }
    final wrapNonce = Uint8List.fromList(bytes.sublist(offset, offset + wrapNonceLength));
    offset += wrapNonceLength;
    final wrapCiphertext =
        Uint8List.fromList(bytes.sublist(offset, offset + wrapCiphertextLength));
    offset += wrapCiphertextLength;

    if (bytes.length < offset + dataNonceLength + dataLengthFieldSize) {
      throw const VaultCorruptHeaderException('Seção de dados truncada.');
    }
    final dataNonce = Uint8List.fromList(bytes.sublist(offset, offset + dataNonceLength));
    offset += dataNonceLength;
    final dataLength =
        ByteData.sublistView(bytes, offset, offset + dataLengthFieldSize).getUint32(0, Endian.big);
    offset += dataLengthFieldSize;

    if (bytes.length < offset + dataLength) {
      throw const VaultCorruptHeaderException('Ciphertext de dados truncado.');
    }
    final dataCiphertext = Uint8List.fromList(bytes.sublist(offset, offset + dataLength));

    return VaultFile(
      header: header,
      wrappedDek: WrappedDek(nonce: wrapNonce, ciphertext: wrapCiphertext),
      dataNonce: dataNonce,
      dataCiphertext: dataCiphertext,
    );
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `flutter test test/core/vault/vault_format_test.dart`
Esperado: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/core/vault/vault_format.dart test/core/vault/vault_format_test.dart
git commit -m "$(cat <<'EOF'
Add binary serialization for the versioned vault file format

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: VaultStorage (gravação atômica e recuperação)

**Files:**
- Create: `lib/core/vault/vault_storage.dart`
- Test: `test/core/vault/vault_storage_test.dart`

**Interfaces:**
- Produces: `class VaultStorage(String vaultPath)` com `Future<bool> exists()`, `Future<Uint8List> readBytes()`, `Future<void> writeAtomic(Uint8List bytes)`, `Future<void> cleanupOrphanedTmp()`. Usado pela Task 9.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vault_storage_test.dart`:

```dart
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:cofre_pessoal/core/vault/vault_storage.dart';
import 'package:path/path.dart' as p;

void main() {
  late Directory tempDir;
  late String vaultPath;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('cofre_pessoal_test_');
    vaultPath = p.join(tempDir.path, 'vault.cpv');
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  test('exists() é falso antes de qualquer gravação e verdadeiro depois', () async {
    final storage = VaultStorage(vaultPath);
    expect(await storage.exists(), isFalse);

    await storage.writeAtomic(Uint8List.fromList([1, 2, 3]));
    expect(await storage.exists(), isTrue);
  });

  test('writeAtomic seguido de readBytes devolve exatamente os mesmos bytes', () async {
    final storage = VaultStorage(vaultPath);
    final conteudo = Uint8List.fromList(List.generate(500, (i) => i % 256));

    await storage.writeAtomic(conteudo);
    final lido = await storage.readBytes();

    expect(lido, conteudo);
  });

  test('writeAtomic não deixa arquivo .tmp para trás após sucesso', () async {
    final storage = VaultStorage(vaultPath);
    await storage.writeAtomic(Uint8List.fromList([1, 2, 3]));

    expect(await File('$vaultPath.tmp').exists(), isFalse);
  });

  test('cleanupOrphanedTmp remove .tmp órfão sem afetar o cofre original válido', () async {
    final storage = VaultStorage(vaultPath);
    final conteudoOriginal = Uint8List.fromList([9, 9, 9]);
    await storage.writeAtomic(conteudoOriginal);

    // Simula uma gravação interrompida: escreve o .tmp mas não completa o rename.
    await File('$vaultPath.tmp').writeAsBytes(Uint8List.fromList([1, 1]));

    await storage.cleanupOrphanedTmp();

    expect(await File('$vaultPath.tmp').exists(), isFalse);
    expect(await storage.readBytes(), conteudoOriginal);
  });

  test('cleanupOrphanedTmp remove .tmp órfão quando o cofre final nunca existiu', () async {
    final storage = VaultStorage(vaultPath);

    // Simula uma criação de cofre interrompida antes do primeiro rename.
    await File('$vaultPath.tmp').writeAsBytes(Uint8List.fromList([1, 1]));

    await storage.cleanupOrphanedTmp();

    expect(await File('$vaultPath.tmp').exists(), isFalse);
    expect(await storage.exists(), isFalse);
  });
}
```

- [ ] **Step 2: Adicionar a dependência `path` (usada só nos testes, para montar caminhos)**

Editar `pubspec.yaml`, em `dev_dependencies:`, adicionar:

```yaml
  path: ^1.9.0
```

Run: `flutter pub get`

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `flutter test test/core/vault/vault_storage_test.dart`
Esperado: FAIL — `vault_storage.dart` não existe.

- [ ] **Step 4: Implementar `vault_storage.dart`**

Criar `lib/core/vault/vault_storage.dart`:

```dart
import 'dart:io';
import 'dart:typed_data';

class VaultStorage {
  final String vaultPath;

  const VaultStorage(this.vaultPath);

  String get _tmpPath => '$vaultPath.tmp';

  Future<bool> exists() => File(vaultPath).exists();

  Future<Uint8List> readBytes() async {
    return File(vaultPath).readAsBytes();
  }

  /// Grava [bytes] atomicamente: escreve num arquivo temporário, sincroniza
  /// com o disco e só então renomeia sobre o arquivo final. Se o app for
  /// encerrado antes do rename, o arquivo final original permanece intacto.
  Future<void> writeAtomic(Uint8List bytes) async {
    final tmpFile = File(_tmpPath);
    final sink = tmpFile.openWrite();
    sink.add(bytes);
    await sink.flush();
    await sink.close();
    await tmpFile.rename(vaultPath);
  }

  /// Remove um `.tmp` órfão deixado por uma gravação interrompida. Deve ser
  /// chamado uma vez na inicialização, antes de qualquer leitura ou escrita.
  Future<void> cleanupOrphanedTmp() async {
    final tmpFile = File(_tmpPath);
    if (await tmpFile.exists()) {
      await tmpFile.delete();
    }
  }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `flutter test test/core/vault/vault_storage_test.dart`
Esperado: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add pubspec.yaml pubspec.lock lib/core/vault/vault_storage.dart test/core/vault/vault_storage_test.dart
git commit -m "$(cat <<'EOF'
Add atomic vault storage with orphaned-write recovery

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: VaultRepository (orquestração completa)

**Files:**
- Create: `lib/core/vault/vault_repository.dart`
- Test: `test/core/vault/vault_repository_test.dart`

**Interfaces:**
- Consumes: `VaultKeyManager`, `WrappedDek` (Task 6); `AeadCipher` (Task 3); `VaultHeader`, exceções (Task 4); `Credential` (Task 5); `VaultFile` (Task 7); `VaultStorage` (Task 8); `Argon2Params` (Task 2).
- Produces: `class VaultRepository({required SodiumSumo sodium, required VaultStorage storage})` com `Future<void> createVault({required String masterPassword, required Argon2Params params, List<Credential> initialCredentials = const []})`, `Future<List<Credential>> openVault({required String masterPassword})`, `Future<void> changeMasterPassword({required String currentPassword, required String newPassword, required Argon2Params params})`. `initialCredentials` existe só para permitir testar nesta fase que credenciais não aparecem em texto puro no arquivo — CRUD completo (adicionar depois da criação, editar, listar) é Fase 2.

- [ ] **Step 1: Escrever os testes**

Criar `test/core/vault/vault_repository_test.dart`:

```dart
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:sodium/sodium_sumo.dart';
import 'package:cofre_pessoal/core/crypto/key_derivation.dart';
import 'package:cofre_pessoal/core/crypto/sodium_provider.dart';
import 'package:cofre_pessoal/core/model/credential.dart';
import 'package:cofre_pessoal/core/vault/vault_exceptions.dart';
import 'package:cofre_pessoal/core/vault/vault_repository.dart';
import 'package:cofre_pessoal/core/vault/vault_storage.dart';
import 'package:path/path.dart' as p;

void main() {
  late SodiumSumo sodium;
  late Argon2Params params;
  late Directory tempDir;
  late String vaultPath;

  setUpAll(() async {
    sodium = await initSodium();
    params = Argon2Params.interactive(sodium);
  });

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('cofre_pessoal_repo_test_');
    vaultPath = p.join(tempDir.path, 'vault.cpv');
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  VaultRepository repository() =>
      VaultRepository(sodium: sodium, storage: VaultStorage(vaultPath));

  test('createVault seguido de openVault com a senha correta devolve lista vazia', () async {
    final repo = repository();
    await repo.createVault(masterPassword: 'frase-senha-ficticia', params: params);

    final credenciais = await repo.openVault(masterPassword: 'frase-senha-ficticia');
    expect(credenciais, isEmpty);
  });

  test('openVault sem cofre existente lança VaultNotFoundException', () async {
    final repo = repository();
    expect(
      () => repo.openVault(masterPassword: 'qualquer-coisa'),
      throwsA(isA<VaultNotFoundException>()),
    );
  });

  test('openVault com senha errada lança VaultAuthenticationFailedException', () async {
    final repo = repository();
    await repo.createVault(masterPassword: 'senha-correta-ficticia', params: params);

    expect(
      () => repo.openVault(masterPassword: 'senha-errada-ficticia'),
      throwsA(isA<VaultAuthenticationFailedException>()),
    );
  });

  test('adulterar um byte do arquivo final faz openVault falhar com senha correta', () async {
    final repo = repository();
    await repo.createVault(masterPassword: 'senha-correta-ficticia', params: params);

    final bytes = await File(vaultPath).readAsBytes();
    final adulterado = Uint8List.fromList(bytes);
    adulterado[adulterado.length - 1] ^= 0xFF; // último byte fica dentro do ciphertext de dados
    await File(vaultPath).writeAsBytes(adulterado);

    expect(
      () => repo.openVault(masterPassword: 'senha-correta-ficticia'),
      throwsA(isA<VaultAuthenticationFailedException>()),
    );
  });

  test('versão de formato desconhecida lança VaultUnsupportedVersionException', () async {
    final repo = repository();
    await repo.createVault(masterPassword: 'senha-correta-ficticia', params: params);

    final bytes = await File(vaultPath).readAsBytes();
    final adulterado = Uint8List.fromList(bytes);
    // Bytes 4-5 = formatVersion (uint16 big-endian). Define uma versão futura inexistente.
    adulterado[4] = 0x00;
    adulterado[5] = 0x63; // 99
    await File(vaultPath).writeAsBytes(adulterado);

    expect(
      () => repo.openVault(masterPassword: 'senha-correta-ficticia'),
      throwsA(isA<VaultUnsupportedVersionException>()),
    );
  });

  test('changeMasterPassword: senha antiga passa a falhar, nova funciona, dados preservados',
      () async {
    final repo = repository();
    await repo.createVault(masterPassword: 'senha-antiga-ficticia', params: params);

    await repo.changeMasterPassword(
      currentPassword: 'senha-antiga-ficticia',
      newPassword: 'senha-nova-ficticia',
      params: params,
    );

    expect(
      () => repo.openVault(masterPassword: 'senha-antiga-ficticia'),
      throwsA(isA<VaultAuthenticationFailedException>()),
    );

    final credenciais = await repo.openVault(masterPassword: 'senha-nova-ficticia');
    expect(credenciais, isEmpty);
  });

  test('o arquivo do cofre em disco não contém a senha mestra nem dados de credenciais em texto puro',
      () async {
    final repo = repository();
    const senha = 'frase-senha-super-secreta-de-teste-9x7z';
    const senhaCredencial = 'senha-da-credencial-ficticia-8k2m';
    const nomeServico = 'Serviço Fictício De Teste XYZ';
    final credencial = Credential(
      id: 'id-ficticio-003',
      serviceName: nomeServico,
      category: 'e-mail',
      username: 'usuario.ficticio.teste@exemplo.invalido',
      password: senhaCredencial,
      createdAt: DateTime.utc(2026, 1, 1),
      updatedAt: DateTime.utc(2026, 1, 1),
    );

    await repo.createVault(
      masterPassword: senha,
      params: params,
      initialCredentials: [credencial],
    );

    final bytes = await File(vaultPath).readAsBytes();
    final conteudo = String.fromCharCodes(bytes.where((b) => b >= 32 && b < 127));
    expect(conteudo.contains(senha), isFalse);
    expect(conteudo.contains(senhaCredencial), isFalse);
    expect(conteudo.contains(nomeServico), isFalse);
    expect(conteudo.contains('usuario.ficticio.teste'), isFalse);

    final credenciaisAbertas = await repo.openVault(masterPassword: senha);
    expect(credenciaisAbertas, hasLength(1));
    expect(credenciaisAbertas.first.serviceName, nomeServico);
    expect(credenciaisAbertas.first.password, senhaCredencial);
  });
}
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `flutter test test/core/vault/vault_repository_test.dart`
Esperado: FAIL — `vault_repository.dart` não existe.

- [ ] **Step 3: Implementar `vault_repository.dart`**

Criar `lib/core/vault/vault_repository.dart`:

```dart
import 'dart:convert';
import 'dart:typed_data';

import 'package:sodium/sodium_sumo.dart';

import '../crypto/aead_cipher.dart';
import '../crypto/key_derivation.dart';
import '../model/credential.dart';
import 'vault_exceptions.dart';
import 'vault_format.dart';
import 'vault_header.dart';
import 'vault_key_manager.dart';
import 'vault_storage.dart';

class VaultRepository {
  final SodiumSumo _sodium;
  final VaultKeyManager _keyManager;
  final AeadCipher _aead;
  final VaultStorage _storage;

  VaultRepository({required SodiumSumo sodium, required VaultStorage storage})
      : _sodium = sodium,
        _keyManager = VaultKeyManager(sodium),
        _aead = AeadCipher(sodium),
        _storage = storage;

  /// [initialCredentials] existe só para permitir testar nesta fase que
  /// credenciais não aparecem em texto puro no arquivo. CRUD completo
  /// (adicionar após a criação, editar, listar) é Fase 2.
  Future<void> createVault({
    required String masterPassword,
    required Argon2Params params,
    List<Credential> initialCredentials = const [],
  }) async {
    await _storage.cleanupOrphanedTmp();

    final dek = _keyManager.generateDek();
    final wrapResult = _keyManager.wrapNewDek(
      dek: dek,
      masterPassword: masterPassword,
      params: params,
    );

    final file = _encryptPayload(
      header: wrapResult.header,
      wrapped: wrapResult.wrapped,
      dek: dek,
      credentials: initialCredentials,
    );
    dek.dispose();

    await _storage.writeAtomic(file.toBytes());
  }

  Future<List<Credential>> openVault({required String masterPassword}) async {
    await _storage.cleanupOrphanedTmp();

    if (!await _storage.exists()) {
      throw const VaultNotFoundException();
    }

    final bytes = await _storage.readBytes();
    final file = VaultFile.fromBytes(bytes);

    if (file.header.formatVersion != VaultHeader.currentVersion) {
      throw VaultUnsupportedVersionException(file.header.formatVersion);
    }

    final dek = _keyManager.unwrapDek(
      header: file.header,
      wrapped: file.wrappedDek,
      masterPassword: masterPassword,
    );

    try {
      return _decryptPayload(header: file.header, file: file, dek: dek);
    } finally {
      dek.dispose();
    }
  }

  Future<void> changeMasterPassword({
    required String currentPassword,
    required String newPassword,
    required Argon2Params params,
  }) async {
    if (!await _storage.exists()) {
      throw const VaultNotFoundException();
    }

    final bytes = await _storage.readBytes();
    final file = VaultFile.fromBytes(bytes);

    if (file.header.formatVersion != VaultHeader.currentVersion) {
      throw VaultUnsupportedVersionException(file.header.formatVersion);
    }

    final dek = _keyManager.unwrapDek(
      header: file.header,
      wrapped: file.wrappedDek,
      masterPassword: currentPassword,
    );

    final rewrapResult = _keyManager.rewrapDek(
      dek: dek,
      newMasterPassword: newPassword,
      params: params,
    );
    dek.dispose();

    final newFile = VaultFile(
      header: rewrapResult.header,
      wrappedDek: rewrapResult.wrapped,
      dataNonce: file.dataNonce,
      dataCiphertext: file.dataCiphertext,
    );
    await _storage.writeAtomic(newFile.toBytes());
  }

  VaultFile _encryptPayload({
    required VaultHeader header,
    required WrappedDek wrapped,
    required SecureKey dek,
    required List<Credential> credentials,
  }) {
    final payloadJson =
        Uint8List.fromList(utf8.encode(jsonEncode(credentials.map((c) => c.toJson()).toList())));
    final nonce = _aead.generateNonce();
    final ciphertext = _aead.encrypt(
      message: payloadJson,
      nonce: nonce,
      key: dek,
      additionalData: header.dataAad,
    );
    return VaultFile(header: header, wrappedDek: wrapped, dataNonce: nonce, dataCiphertext: ciphertext);
  }

  List<Credential> _decryptPayload({
    required VaultHeader header,
    required VaultFile file,
    required SecureKey dek,
  }) {
    try {
      final plainBytes = _aead.decrypt(
        cipherText: file.dataCiphertext,
        nonce: file.dataNonce,
        key: dek,
        additionalData: header.dataAad,
      );
      final decoded = jsonDecode(utf8.decode(plainBytes)) as List<dynamic>;
      return decoded.map((e) => Credential.fromJson(e as Map<String, dynamic>)).toList();
    } on Exception {
      throw const VaultAuthenticationFailedException();
    }
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `flutter test test/core/vault/vault_repository_test.dart`
Esperado: PASS (8 testes).

- [ ] **Step 5: Rodar a suíte inteira**

Run: `flutter test`
Esperado: todos os testes das Tasks 1–9 passando.

- [ ] **Step 6: Commit**

```bash
git add lib/core/vault/vault_repository.dart test/core/vault/vault_repository_test.dart
git commit -m "$(cat <<'EOF'
Add VaultRepository orchestrating create/open/change-password flows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Benchmark do Argon2id, análise estática e relatório de entrega da fase

**Files:**
- Create: `test/core/crypto/argon2id_benchmark_test.dart`
- Create: `docs/fase1-entrega.md`

**Interfaces:**
- Consumes: `KeyDerivation`, `Argon2Params` (Task 2).

- [ ] **Step 1: Escrever o teste de benchmark**

Criar `test/core/crypto/argon2id_benchmark_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:sodium/sodium_sumo.dart';
import 'package:cofre_pessoal/core/crypto/key_derivation.dart';
import 'package:cofre_pessoal/core/crypto/sodium_provider.dart';

void main() {
  test('mede o tempo do Argon2id (preset INTERACTIVE) no host de desenvolvimento', () async {
    final SodiumSumo sodium = await initSodium();
    final kdf = KeyDerivation(sodium);
    final salt = kdf.generateSalt();
    final params = Argon2Params.interactive(sodium);

    final stopwatch = Stopwatch()..start();
    final key = kdf.deriveKey(
      password: 'frase-senha-ficticia-de-teste',
      salt: salt,
      params: params,
      outLen: 32,
    );
    stopwatch.stop();

    final keyBytes = key.extractBytes();
    expect(keyBytes.length, 32);
    keyBytes.fillRange(0, keyBytes.length, 0);
    key.dispose();

    // Medição só de referência do host de desenvolvimento — não representa um
    // celular real. O valor impresso aqui deve ser copiado manualmente para
    // docs/fase1-entrega.md, com a ressalva de que precisa revalidação em
    // dispositivo Android real antes de qualquer uso além de teste.
    // ignore: avoid_print
    print(
      'Argon2id INTERACTIVE (mem=${params.memLimit}B, ops=${params.opsLimit}) '
      'no host: ${stopwatch.elapsedMilliseconds}ms',
    );
  });
}
```

- [ ] **Step 2: Rodar o teste e capturar o tempo medido**

Run: `flutter test test/core/crypto/argon2id_benchmark_test.dart --reporter expanded`
Esperado: PASS, com uma linha impressa tipo `Argon2id INTERACTIVE (mem=67108864B, ops=2) no host: <N>ms`. Anotar o valor de `<N>` para o próximo passo.

- [ ] **Step 3: Rodar a análise estática em todo o projeto**

Run: `flutter analyze`
Esperado: "No issues found!". Corrigir qualquer aviso antes de prosseguir.

- [ ] **Step 4: Rodar a suíte de testes completa uma última vez**

Run: `flutter test`
Esperado: todos os testes passando (Tasks 1–10).

- [ ] **Step 5: Escrever o relatório de entrega da fase**

Criar `docs/fase1-entrega.md` (substituir `<N>` pelo valor medido no Step 2):

```markdown
# Fase 1 — Relatório de Entrega

## O que foi construído

Núcleo criptográfico completo do Cofre Pessoal, sem UI: derivação de chave via
Argon2id, envelope encryption da chave do cofre (DEK) protegida por uma chave
derivada da senha mestra (KEK), criptografia autenticada dos dados via
XChaCha20-Poly1305, formato de arquivo binário versionado, gravação atômica
com recuperação de gravação interrompida, e a API de orquestração
(`VaultRepository`) usada para criar, abrir e trocar a senha mestra de um
cofre.

## Bibliotecas usadas

- `sodium: ^4.1.0` — bindings Dart/Flutter para libsodium (Argon2id via
  variante "sumo", XChaCha20-Poly1305 IETF). Justificativa completa em
  docs/superpowers/specs/2026-09-02-fase1-nucleo-criptografico-design.md.

## Arquivos principais

- `lib/core/crypto/` — wrappers de KDF e AEAD sobre o `sodium`.
- `lib/core/vault/` — gerenciamento de chaves, formato binário, storage
  atômico e o repositório de orquestração.
- `lib/core/model/credential.dart` — modelo de dados das credenciais.

## Como rodar os testes

```bash
flutter test
```

## Parâmetros do Argon2id — medição provisória

Preset usado nesta fase: `INTERACTIVE` (64 MiB de memória, 2 iterações).

Tempo medido no host de desenvolvimento: **<N> ms**.

**Isto é provisório.** O host de desenvolvimento não é representativo do
hardware de um celular real — principalmente aparelhos de entrada, que têm
CPU e memória mais restritas. Antes de qualquer uso além de testes, este
parâmetro precisa ser remedido em pelo menos um dispositivo Android real (ou
emulador com hardware representativo), o que só é possível a partir da fase
em que o app já roda de fato (UI). Se o tempo de desbloqueio medido no
aparelho real for muito alto, considerar reduzir para valores customizados
entre `INTERACTIVE` e `MODERATE`; se for baixo o suficiente, considerar subir
para `MODERATE` (256 MiB) para aumentar a margem de segurança contra ataques
offline.

## Limitações conhecidas ao final desta fase

- Sem UI — tudo validado só por testes automatizados.
- Parâmetros do Argon2id não validados em dispositivo real (ver acima).
- Sem biometria, backup/restauração como funcionalidade de usuário, ou
  proteção de bloqueio de tela — ficam para as fases seguintes.
- Limpeza de memória: `SecureKey` é zerado via `.dispose()`, e `Uint8List`
  extraídos dele são zerados manualmente após uso, mas a `String` da senha
  mestra em si (vinda de um parâmetro de texto) não tem essa garantia — Dart
  não expõe uma forma de zerar `String` de forma confiável, já que strings são
  imutáveis e podem ser copiadas/realocadas pelo garbage collector antes de
  qualquer tentativa de limpeza. Isso é uma limitação da linguagem, não deste
  código, e fica documentada aqui para as fases seguintes lidarem com o
  melhor compromisso possível (ex.: minimizar o tempo de vida da variável).

## Próxima fase

Fase 2 — senha mestra, desbloqueio e CRUD de credenciais (UI básica), que
consome `VaultRepository` diretamente.
```

- [ ] **Step 6: Commit**

```bash
git add test/core/crypto/argon2id_benchmark_test.dart docs/fase1-entrega.md
git commit -m "$(cat <<'EOF'
Add Argon2id host benchmark and Phase 1 delivery report

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
