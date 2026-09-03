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
