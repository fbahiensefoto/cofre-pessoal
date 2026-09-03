import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';
import type { Credential } from '../../core/model/credential';
import type { Person } from '../../core/model/person';
import type { VaultSession } from '../../core/vault/vaultRepository';
import { VaultRepository } from '../../core/vault/vaultRepository';

export interface VaultSessionContextValue {
  people: Person[];
  credentials: Credential[];
  addPerson(name: string): Promise<Person>;
  addCredential(input: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>;
  updateCredential(id: string, input: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>;
  deleteCredential(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  lock(): void;
}

const VaultSessionReactContext = createContext<VaultSessionContextValue | null>(null);

export function useVaultSession(): VaultSessionContextValue {
  const value = useContext(VaultSessionReactContext);
  if (!value) {
    throw new Error('useVaultSession precisa ser usado dentro de um VaultSessionProvider.');
  }
  return value;
}

/** Deriva pessoas "órfãs": nomes usados em credenciais de antes da Pessoa virar um
 * registro próprio, que ainda não têm um Person correspondente. Sem isso, uma
 * credencial antiga com owner definido desapareceria da lista de pessoas. */
function derivarPessoasOrfas(pessoasRegistradas: Person[], credenciais: Credential[]): Person[] {
  const nomesRegistrados = new Set(pessoasRegistradas.map((p) => p.name));
  const nomesOrfaos = [...new Set(credenciais.map((c) => c.owner).filter((nome) => nome && !nomesRegistrados.has(nome)))];
  const agora = new Date().toISOString();
  return nomesOrfaos.map((nome) => ({ id: crypto.randomUUID(), name: nome, createdAt: agora, updatedAt: agora }));
}

export function VaultSessionProvider(props: {
  repository: VaultRepository;
  session: VaultSession;
  initialPeople: Person[];
  initialCredentials: Credential[];
  onLock: () => void;
  children: ComponentChildren;
}) {
  const { repository, session, onLock } = props;
  const [people, setPeople] = useState<Person[]>(() => [
    ...props.initialPeople,
    ...derivarPessoasOrfas(props.initialPeople, props.initialCredentials),
  ]);
  const [credentials, setCredentials] = useState<Credential[]>(props.initialCredentials);

  const persist = useCallback(
    async (nextPeople: Person[], nextCredentials: Credential[]) => {
      await repository.saveVaultData(session, { people: nextPeople, credentials: nextCredentials });
      setPeople(nextPeople);
      setCredentials(nextCredentials);
    },
    [repository, session],
  );

  const addPerson = useCallback(
    async (name: string) => {
      const nomeNormalizado = name.trim();
      const existente = people.find((p) => p.name.trim().toLowerCase() === nomeNormalizado.toLowerCase());
      if (existente) {
        return existente;
      }
      const now = new Date().toISOString();
      const novaPessoa: Person = { id: crypto.randomUUID(), name: nomeNormalizado, createdAt: now, updatedAt: now };
      await persist([...people, novaPessoa], credentials);
      return novaPessoa;
    },
    [people, credentials, persist],
  );

  const addCredential = useCallback(
    async (input: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const novaCredencial: Credential = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      await persist(people, [...credentials, novaCredencial]);
    },
    [people, credentials, persist],
  );

  const updateCredential = useCallback(
    async (id: string, input: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const next = credentials.map((c) => (c.id === id ? { ...c, ...input, updatedAt: now } : c));
      await persist(people, next);
    },
    [people, credentials, persist],
  );

  const deleteCredential = useCallback(
    async (id: string) => {
      await persist(
        people,
        credentials.filter((c) => c.id !== id),
      );
    },
    [people, credentials, persist],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const next = credentials.map((c) => (c.id === id ? { ...c, favorite: !c.favorite, updatedAt: now } : c));
      await persist(people, next);
    },
    [people, credentials, persist],
  );

  const lock = useCallback(() => {
    repository.closeSession(session);
    onLock();
  }, [repository, session, onLock]);

  const value: VaultSessionContextValue = {
    people,
    credentials,
    addPerson,
    addCredential,
    updateCredential,
    deleteCredential,
    toggleFavorite,
    lock,
  };

  return <VaultSessionReactContext.Provider value={value}>{props.children}</VaultSessionReactContext.Provider>;
}
