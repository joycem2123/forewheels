import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addBooking,
  advance,
  cancelBooking,
  checkBooking,
  newMember,
  PLANS,
  quoteFor,
  switchPlan,
  type AppData,
  type Booking,
  type Member,
  type NewBooking,
  type PlanId,
} from '@forewheels/engine';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { charge, refund } from '@/lib/payments';

/** Saved on the phone. Bump when the saved shape changes. */
export const STORE_VERSION = 2;

/** Each account keeps its own data on the phone; signed-out use is the phone's guest data. */
export const GUEST_KEY = 'guest';
export const accountKey = (userId: string | null | undefined, anonymous = false) => (!userId || anonymous ? GUEST_KEY : `user:${userId}`);

interface State {
  /** Has this phone been past the welcome screen (signed in, or chose to look around as a guest)? */
  onboarded: boolean;
  accountKey: string;
  accounts: Record<string, AppData>;
  /** The current account's data. */
  data: AppData;
  /** The booking being reviewed on the checkout sheet (not saved). */
  draft: NewBooking | null;
  toast: string | null;
  setOnboarded: (v: boolean) => void;
  /** Load an account's data, starting it from `start` (or a blank member) the first time. */
  switchAccount: (key: string, start?: AppData) => void;
  setDraft: (d: NewBooking | null) => void;
  notify: (msg: string) => void;
  /** Marks finished jobs as ready. Called on a timer while the app is open. */
  refresh: () => void;
  book: (b: NewBooking) => Promise<Booking>;
  cancel: (id: string) => Promise<string>;
  changePlan: (p: PlanId) => Promise<void>;
  updateMember: (patch: Partial<Member>) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Save the current account's data (and its copy in the per-account list). */
      const commit = (data: AppData) => set((s) => ({ data, accounts: { ...s.accounts, [s.accountKey]: data } }));
      return {
        onboarded: false,
        accountKey: GUEST_KEY,
        accounts: {},
        data: newMember(),
        draft: null,
        toast: null,
        setOnboarded: (onboarded) => set({ onboarded }),
        switchAccount: (key, start) =>
          set((s) => {
            const accounts = { ...s.accounts, [s.accountKey]: s.data };
            const data = accounts[key] ?? start ?? newMember();
            return { accountKey: key, accounts: { ...accounts, [key]: data }, data, draft: null };
          }),
        setDraft: (draft) => set({ draft }),
        notify: (toast) => {
          set({ toast });
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => set({ toast: null }), 3000);
        },
        refresh: () => {
          const d = get().data;
          const next = advance(d);
          if (next !== d) commit(next);
        },
        // Signed-in members book, cancel and change pass on the server (so staff see it);
        // the phone-only path remains for offline demos and tests.
        async book(input) {
          const problem = checkBooking(input);
          if (problem) throw new Error(problem);
          const q = quoteFor(get().data, input);
          const ref = q.total > 0 ? (await charge(q.total, input.paymentMethod)).ref : null;
          if (get().accountKey !== GUEST_KEY) {
            const { bookOnline } = await import('@/sync/bookings');
            return await bookOnline(input, q, ref);
          }
          const r = addBooking(get().data, input, ref);
          commit(r.data);
          return r.booking;
        },
        async cancel(id) {
          if (get().accountKey !== GUEST_KEY) {
            const { cancelOnline } = await import('@/sync/bookings');
            const r = await cancelOnline(id);
            await refund(r.paymentRef, r.refund);
            return r.message;
          }
          const r = cancelBooking(get().data, id);
          await refund(r.paymentRef, r.refund);
          commit(r.data);
          return r.message;
        },
        async changePlan(plan) {
          const d = get().data;
          const price = PLANS[plan].price[d.member.vehicle.size];
          if (price > 0) await charge(price, d.member.defaultPayment);
          if (get().accountKey !== GUEST_KEY) {
            const { setPlanOnline } = await import('@/sync/bookings');
            return await setPlanOnline(plan);
          }
          commit(switchPlan(get().data, plan));
        },
        updateMember: (patch) => commit({ ...get().data, member: { ...get().data.member, ...patch } }),
      };
    },
    {
      name: 'forewheels',
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ onboarded: s.onboarded, accountKey: s.accountKey, accounts: s.accounts, data: s.data }),
      // Version 1 held the sample member only: start fresh.
      migrate: () => ({ onboarded: false, accountKey: GUEST_KEY, accounts: {}, data: newMember() }) as never,
    },
  ),
);

/** Is someone signed in to a real (non-guest) account on this phone? */
export const useSignedIn = () => useStore((s) => s.accountKey !== GUEST_KEY);
