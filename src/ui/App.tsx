import { useEffect, useState } from 'preact/hooks';
import { initSodium, type Sodium } from '../core/crypto/sodiumProvider';
import type { Credential } from '../core/model/credential';
import type { Person } from '../core/model/person';
import { VaultRepository, type VaultSession } from '../core/vault/vaultRepository';
import { VaultStorage } from '../core/vault/vaultStorage';
import { VaultSessionProvider } from './state/VaultSessionContext';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { UnlockScreen } from './screens/UnlockScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import { PersonCredentialsScreen } from './screens/PersonCredentialsScreen';
import { CredentialDetailScreen } from './screens/CredentialDetailScreen';
import { CredentialFormScreen } from './screens/CredentialFormScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type GateState =
  | { kind: 'loading' }
  | { kind: 'welcome' }
  | { kind: 'unlock' }
  | { kind: 'unlocked'; session: VaultSession; people: Person[]; credentials: Credential[] };

type MainView =
  | { view: 'people' }
  | { view: 'person'; owner: string }
  | { view: 'detail'; id: string; owner: string }
  | { view: 'form'; id?: string; owner: string }
  | { view: 'settings' };

export function App() {
  const [sodium, setSodium] = useState<Sodium | null>(null);
  const [repository, setRepository] = useState<VaultRepository | null>(null);
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
  const [mainView, setMainView] = useState<MainView>({ view: 'people' });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const s = await initSodium();
      const repo = new VaultRepository(s, new VaultStorage());
      const existe = await new VaultStorage().exists();
      if (cancelado) return;
      setSodium(s);
      setRepository(repo);
      setGate(existe ? { kind: 'unlock' } : { kind: 'welcome' });
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  function handleUnlockedOrCreated(result: { session: VaultSession; people: Person[]; credentials: Credential[] }) {
    setGate({ kind: 'unlocked', session: result.session, people: result.people, credentials: result.credentials });
    setMainView({ view: 'people' });
  }

  function handleLock() {
    setGate({ kind: 'unlock' });
  }

  if (gate.kind === 'loading' || !sodium || !repository) {
    return <div className="loading">Carregando…</div>;
  }

  if (gate.kind === 'welcome') {
    return <WelcomeScreen repository={repository} sodium={sodium} onCreated={handleUnlockedOrCreated} />;
  }

  if (gate.kind === 'unlock') {
    return <UnlockScreen repository={repository} onUnlocked={handleUnlockedOrCreated} />;
  }

  return (
    <VaultSessionProvider
      repository={repository}
      session={gate.session}
      initialPeople={gate.people}
      initialCredentials={gate.credentials}
      onLock={handleLock}
    >
      {mainView.view === 'people' && (
        <PeopleScreen
          onSelectPerson={(owner) => setMainView({ view: 'person', owner })}
          onOpenSettings={() => setMainView({ view: 'settings' })}
        />
      )}
      {mainView.view === 'person' && (
        <PersonCredentialsScreen
          owner={mainView.owner}
          onBack={() => setMainView({ view: 'people' })}
          onSelectCredential={(id) => setMainView({ view: 'detail', id, owner: mainView.owner })}
          onCreateNew={() => setMainView({ view: 'form', owner: mainView.owner })}
        />
      )}
      {mainView.view === 'detail' && (
        <CredentialDetailScreen
          credentialId={mainView.id}
          onBack={() => setMainView({ view: 'person', owner: mainView.owner })}
          onEdit={(id) => setMainView({ view: 'form', id, owner: mainView.owner })}
        />
      )}
      {mainView.view === 'form' && (
        <CredentialFormScreen
          credentialId={mainView.id}
          initialOwner={mainView.owner}
          onDone={(savedOwner) => setMainView({ view: 'person', owner: savedOwner })}
          onCancel={() => setMainView({ view: 'person', owner: mainView.owner })}
        />
      )}
      {mainView.view === 'settings' && (
        <SettingsScreen repository={repository} onBack={() => setMainView({ view: 'people' })} />
      )}
    </VaultSessionProvider>
  );
}
