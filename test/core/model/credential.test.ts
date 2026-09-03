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
