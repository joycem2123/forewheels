import { useEffect } from 'react';
import { AppState } from 'react-native';

import { GUEST_KEY, useStore } from '@/store/store';
import { useSession } from './auth';
import { listenToMine, pullMine } from './bookings';
import { registerForPush } from './push';

/** Keeps a signed-in member's bookings in sync: loads them, listens for staff updates, and refreshes on reopen. */
export function SyncProvider() {
  const session = useSession();
  const accountKey = useStore((s) => s.accountKey);
  const uid = session?.user && !session.user.is_anonymous && accountKey !== GUEST_KEY ? session.user.id : null;

  useEffect(() => {
    if (!uid) return;
    void pullMine();
    void registerForPush();
    const stop = listenToMine(uid);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void pullMine(); });
    return () => {
      stop();
      sub.remove();
    };
  }, [uid]);

  return null;
}
