import { useEffect, useState } from 'react';

import { useStore } from '@/store/store';

/** The current time, updated every 20 seconds so live progress moves. Also marks finished jobs ready. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  const refresh = useStore((s) => s.refresh);
  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      setNow(Date.now());
      refresh();
    }, 20000);
    return () => clearInterval(id);
  }, [refresh]);
  return now;
}
