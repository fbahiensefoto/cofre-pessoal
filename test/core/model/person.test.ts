import { describe, expect, it } from 'vitest';
import type { Person } from '../../../src/core/model/person';

describe('Person', () => {
  it('round-trip: JSON.parse(JSON.stringify()) preserva todos os campos', () => {
    const original: Person = {
      id: 'id-pessoa-ficticia-001',
      name: 'Pessoa Fictícia',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    const restored = JSON.parse(JSON.stringify(original)) as Person;

    expect(restored).toEqual(original);
  });
});
