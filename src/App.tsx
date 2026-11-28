import React, { useCallback, useEffect, useRef, useState } from 'react';
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

  // Revision counter & serialized signature prevent stale polls from overwriting
  // recent mutations (e.g. toggling "llamada") or triggering no-op re-renders.
  const stateRevisionRef = useRef(0);
  const lastSerializedRef = useRef<string>(JSON.stringify(defaultStoreJson));
  const syncPausedRef = useRef<boolean>(false);

  const applyState = useCallback((next: AppState, fromMutation = true) => {
    if (fromMutation) {
      stateRevisionRef.current += 1;
    }
    const serialized = JSON.stringify(next);
    if (serialized === lastSerializedRef.current) {
      return;
    }
    lastSerializedRef.current = serialized;
    setAppState(next);
  }, []);

  const handleStateChangeFromChild = useCallback(
    (next: AppState) => {
      applyState(next, true);
    },
    [applyState]
  );

  const handleSyncPauseChange = useCallback((paused: boolean) => {
    syncPausedRef.current = paused;
    if (paused) {
      // Invalidate any poll currently in flight so it cannot clobber UI/mutations.
      stateRevisionRef.current += 1;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const load = async (force = false) => {
      if (!active || inFlight) return;
      if (!force && (document.visibilityState === 'hidden' || syncPausedRef.current)) {
        return;
      }
      inFlight = true;
      const revBefore = stateRevisionRef.current;
      try {
        const res = await fetchAppState();
        if (!active) return;
        setSyncMode((prev) => (prev === res.mode ? prev : res.mode));
        if (revBefore !== stateRevisionRef.current || (!force && syncPausedRef.current)) {
          return;
        }
        applyState(res.state, false);
      } catch {
        // Fallback already handled inside fetchAppState
      } finally {
        inFlight = false;
      }
    };

    void load(true);

    const unsubscribe = subscribeStoreSync((synced) => {
      if (!active || syncPausedRef.current) return;
      applyState(synced, false);
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void load(false);
      }
    };
    const onWindowFocus = () => {
      void load(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    const intervalMs = isDashboard ? 3500 : 12000;
    const timer = window.setInterval(() => {
      void load(false);
    }, intervalMs);

    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
      window.clearInterval(timer);
    };
  }, [isDashboard, applyState]);

  if (isDashboard) {
    return (
      <DashboardPage
        appState={appState}
        syncMode={syncMode}
        onStateChange={handleStateChangeFromChild}
        onSyncPauseChange={handleSyncPauseChange}
      />
    );
  }

  return <ReferralFlow appState={appState} onStateChange={handleStateChangeFromChild} />;
};

export default App;
