import { useEffect, useState } from 'preact/hooks';
import { initSodium, type Sodium } from '../core/crypto/sodiumProvider';
import type { Credential } from '../core/model/credential';
import { VaultRepository, type VaultSession } from '../core/vault/vaultRepository';
import { VaultStorage } from '../core/vault/vaultStorage';
import { VaultSessionProvider } from './state/VaultSessionContext';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { UnlockScreen } from './screens/UnlockScreen';
import { VaultListScreen } from './screens/VaultListScreen';
import { CredentialDetailScreen } from './screens/CredentialDetailScreen';
import { CredentialFormScreen } from './screens/CredentialFormScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type GateState =
  | { kind: 'loading' }
  | { kind: 'welcome' }
  | { kind: 'unlock' }
  | { kind: 'unlocked'; session: VaultSession; credentials: Credential[] };

type MainView = { view: 'list' } | { view: 'detail'; id: string } | { view: 'form'; id?: string } | { view: 'settings' };

export function App() {
  const [sodium, setSodium] = useState<Sodium | null>(null);
  const [repository, setRepository] = useState<VaultRepository | null>(null);
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
  const [mainView, setMainView] = useState<MainView>({ view: 'list' });

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

  function handleUnlockedOrCreated(result: { session: VaultSession; credentials: Credential[] }) {
    setGate({ kind: 'unlocked', session: result.session, credentials: result.credentials });
    setMainView({ view: 'list' });
  }

  function handleLock() {
    setGate({ kind: 'unlock' });
  }

  if (gate.kind === 'loading' || !sodium || !repository) {
    return <div>Carregando…</div>;
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
      initialCredentials={gate.credentials}
      onLock={handleLock}
    >
      {mainView.view === 'list' && (
        <VaultListScreen
          onSelectCredential={(id) => setMainView({ view: 'detail', id })}
          onCreateNew={() => setMainView({ view: 'form' })}
          onOpenSettings={() => setMainView({ view: 'settings' })}
        />
      )}
      {mainView.view === 'detail' && (
        <CredentialDetailScreen
          credentialId={mainView.id}
          onBack={() => setMainView({ view: 'list' })}
          onEdit={(id) => setMainView({ view: 'form', id })}
        />
      )}
      {mainView.view === 'form' && (
        <CredentialFormScreen
          credentialId={mainView.id}
          onDone={() => setMainView({ view: 'list' })}
          onCancel={() => setMainView({ view: 'list' })}
        />
      )}
      {mainView.view === 'settings' && (
        <SettingsScreen repository={repository} onBack={() => setMainView({ view: 'list' })} />
      )}
    </VaultSessionProvider>
  );
}
