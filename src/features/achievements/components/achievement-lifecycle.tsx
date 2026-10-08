import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/auth-context';
import type { AchievementDomainEvent } from '@/domain/events/achievement-event';
import { achievementKeys, achievementService, useAchievements } from '../hooks/use-achievements';
import { pendingUnlocks } from '../services/achievement-rules';
import { AchievementUnlockModal } from './achievement-unlock-modal';
import { ForegroundRefresh } from '@/services/realtime/foreground-refresh';
import { useAppStore } from '@/store/app-store';
import { writeInvalidationKeys } from '@/services/query/write-invalidation';

export function AchievementLifecycle() {
  const { user } = useAuth();
  // Remount to isolate transient presentation state on account changes.
  return user ? <AchievementSession key={user.id} owner={user.id} /> : null;
}
function AchievementSession({ owner }: { owner: string }) {
  const board = useAchievements(); const client = useQueryClient();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const offline = useAppStore((state) => state.isOffline);
  useEffect(() => {
    let disposed = false;
    let event: AchievementDomainEvent | undefined;
    async function reconcile() {
      if (disposed) return;
      try {
        const next = event; event = undefined;
        if (next) await achievementService.handleEvent(owner, next);
        else await achievementService.reconcile(owner);
        if (!disposed) await client.invalidateQueries({ queryKey: achievementKeys.board(owner) });
      } catch {
        // Offline: no invented awards. Foreground/reconnect/poll retries confirmed facts.
      }
    }
    const lifecycle = new ForegroundRefresh((changed) => achievementService.subscribe(owner,
      (next) => { if (!disposed) { event = next; changed(); } },
      () => {
        if (disposed) return;
        for (const queryKey of writeInvalidationKeys('achievement', owner)) void client.invalidateQueries({ queryKey });
        changed();
      }, changed), reconcile, 30_000);
    function update(state: string) {
      setForeground(state === 'active');
      lifecycle.setActive(state === 'active' && !offline);
    }
    const appState = AppState.addEventListener('change', update);
    update(AppState.currentState);
    return () => { disposed = true; lifecycle.dispose(); appState.remove(); };
  }, [owner, client, offline]);
  const pending = pendingUnlocks(board.data?.entries ?? [], hidden)[0];
  if (!pending || !foreground) return null;
  function hide(id: string) { setHidden((old) => new Set([...old, id])); setError(null); }
  async function confirm(id: string) {
    setSaving(true); setError(null);
    try {
      await achievementService.acknowledge(owner, id); hide(id);
      await client.invalidateQueries({ queryKey: achievementKeys.board(owner) });
    } catch { setError('Your badge is saved. Could not dismiss it permanently; please try again when connected.'); }
    finally { setSaving(false); }
  }
  return <AchievementUnlockModal key={pending.id} achievement={pending} saving={saving} error={error} onConfirm={() => { void confirm(pending.id); }} onDismiss={() => { if (!saving) hide(pending.id); }} />;
}
