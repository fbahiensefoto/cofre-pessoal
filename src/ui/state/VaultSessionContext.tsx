import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';
import type { Credential } from '../../core/model/credential';
import type { VaultSession } from '../../core/vault/vaultRepository';
import { VaultRepository } from '../../core/vault/vaultRepository';

export interface VaultSessionContextValue {
  credentials: Credential[];
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

export function VaultSessionProvider(props: {
  repository: VaultRepository;
  session: VaultSession;
  initialCredentials: Credential[];
  onLock: () => void;
  children: ComponentChildren;
}) {
  const { repository, session, onLock } = props;
  const [credentials, setCredentials] = useState<Credential[]>(props.initialCredentials);

  const persist = useCallback(
    async (next: Credential[]) => {
      await repository.saveCredentials(session, next);
      setCredentials(next);
    },
    [repository, session],
  );

  const addCredential = useCallback(
    async (input: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const novaCredencial: Credential = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      await persist([...credentials, novaCredencial]);
    },
    [credentials, persist],
  );

  const updateCredential = useCallback(
    async (id: string, input: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const next = credentials.map((c) => (c.id === id ? { ...c, ...input, updatedAt: now } : c));
      await persist(next);
    },
    [credentials, persist],
  );

  const deleteCredential = useCallback(
    async (id: string) => {
      await persist(credentials.filter((c) => c.id !== id));
    },
    [credentials, persist],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const next = credentials.map((c) => (c.id === id ? { ...c, favorite: !c.favorite, updatedAt: now } : c));
      await persist(next);
    },
    [credentials, persist],
  );

  const lock = useCallback(() => {
    repository.closeSession(session);
    onLock();
  }, [repository, session, onLock]);

  const value: VaultSessionContextValue = {
    credentials,
    addCredential,
    updateCredential,
    deleteCredential,
    toggleFavorite,
    lock,
  };

  return <VaultSessionReactContext.Provider value={value}>{props.children}</VaultSessionReactContext.Provider>;
}
