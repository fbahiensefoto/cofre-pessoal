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
    saltAdulterado[0]! ^= 0xff;
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

  it('adulterar o formatVersion do cabeçalho invalida a chave embrulhada (testa AAD especificamente)', () => {
    const dek = keyManager.generateDek();
    const { header, wrapped } = keyManager.wrapNewDek(dek, 'senha-correta-ficticia', params);

    const headerAdulterado = new VaultHeader(
      header.formatVersion + 1,
      header.kdfMemLimit,
      header.kdfOpsLimit,
      header.salt,
    );

    expect(() => keyManager.unwrapDek(headerAdulterado, wrapped, 'senha-correta-ficticia')).toThrow(
      VaultAuthenticationFailedError,
    );
  });

  it('unwrapDek com kdfOpsLimit fora do intervalo válido lança VaultAuthenticationFailedError', () => {
    const dek = keyManager.generateDek();
    const { header, wrapped } = keyManager.wrapNewDek(dek, 'senha-correta-ficticia', params);

    const headerComOpsLimitInvalido = new VaultHeader(
      header.formatVersion,
      header.kdfMemLimit,
      0,
      header.salt,
    );

    expect(() => keyManager.unwrapDek(headerComOpsLimitInvalido, wrapped, 'senha-correta-ficticia')).toThrow(
      VaultAuthenticationFailedError,
    );
  });
});
