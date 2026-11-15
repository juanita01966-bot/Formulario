import React, { useEffect, useState } from 'react';
import defaultStoreJson from './shared/defaultStore.json';
import type { AppState } from './types/app';
import { fetchAppState, subscribeStoreSync } from './services/storeClient';
import { ReferralFlow } from './pages/ReferralFlow';
import { DashboardPage } from './pages/DashboardPage';

function isDashboardHash(hash: string): boolean {
  const normalized = hash.trim().toLowerCase();
  return normalized === '#/dsb' || normalized.startsWith('#/dsb/') || normalized.startsWith('#/dsb?');
}

export const App: React.FC = () => {
  const [hash, setHash] = useState<string>(() => window.location.hash);
  const [appState, setAppState] = useState<AppState>(() => defaultStoreJson as AppState);
  const [syncMode, setSyncMode] = useState<'api' | 'local'>('local');

  const isDashboard = isDashboardHash(hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAppState();
        if (active) {
          setAppState(res.state);
          setSyncMode(res.mode);
        }
      } catch {
        // Fallback already handled inside fetchAppState
      }
    };

    load();
    const unsubscribe = subscribeStoreSync((synced) => {
      if (active) setAppState(synced);
    });

    const intervalMs = isDashboard ? 3000 : 12000;
    const timer = window.setInterval(load, intervalMs);

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [isDashboard]);

  if (isDashboard) {
    return (
      <DashboardPage
        appState={appState}
        syncMode={syncMode}
        onStateChange={setAppState}
      />
    );
  }

  return <ReferralFlow appState={appState} onStateChange={setAppState} />;
};

export default App;
