import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as api from '../api/client';
import type { AppData, Booking, Member, NewBooking } from '@forewheels/engine';
import type { PlanId } from '@forewheels/engine';

export type Tab = 'home' | 'book' | 'bookings' | 'passes' | 'me';
const TABS: Tab[] = ['home', 'book', 'bookings', 'passes', 'me'];

interface Store {
  data: AppData | null;
  now: number;
  tab: Tab;
  go: (t: Tab) => void;
  toast: string | null;
  notify: (msg: string) => void;
  book: (b: NewBooking) => Promise<Booking>;
  cancel: (id: string) => Promise<void>;
  changePlan: (p: PlanId) => Promise<void>;
  updateMember: (patch: Partial<Member>) => Promise<void>;
  reset: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

function tabFromHash(): Tab {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.includes(h) ? h : 'home';
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number>();

  useEffect(() => { api.getData().then((d) => setData(api.tick(d))); }, []);

  // Live progress: refresh every 20 seconds.
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setData((d) => (d ? api.tick(d) : d));
    }, 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((t: Tab) => {
    setTab(t);
    if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
    window.scrollTo({ top: 0 });
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const store = useMemo<Store>(() => ({
    data, now, tab, go, toast, notify,
    async book(b) {
      const r = await api.createBooking(b);
      setData(r.data);
      return r.booking;
    },
    async cancel(id) {
      const r = await api.cancelBooking(id);
      setData(r.data);
      notify(r.message);
    },
    async changePlan(p) {
      setData(await api.changePlan(p));
    },
    async updateMember(patch) {
      setData(await api.updateMember(patch));
    },
    async reset() {
      setData(await api.resetDemo());
      notify('Sample data restored');
    },
  }), [data, now, tab, go, toast, notify]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
