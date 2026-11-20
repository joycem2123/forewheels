import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addBooking,
  advance,
  cancelBooking,
  checkBooking,
  PLANS,
  quoteFor,
  seed,
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
export const STORE_VERSION = 1;

interface State {
  data: AppData;
  /** The booking being reviewed on the checkout sheet (not saved). */
  draft: NewBooking | null;
  toast: string | null;
  setDraft: (d: NewBooking | null) => void;
  notify: (msg: string) => void;
  /** Marks finished jobs as ready. Called on a timer while the app is open. */
  refresh: () => void;
  book: (b: NewBooking) => Promise<Booking>;
  cancel: (id: string) => Promise<string>;
  changePlan: (p: PlanId) => Promise<void>;
  updateMember: (patch: Partial<Member>) => void;
  reset: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      data: seed(),
      draft: null,
      toast: null,
      setDraft: (draft) => set({ draft }),
      notify: (toast) => {
        set({ toast });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: null }), 3000);
      },
      refresh: () => {
        const d = get().data;
        const next = advance(d);
        if (next !== d) set({ data: next });
      },
      async book(input) {
        const problem = checkBooking(input);
        if (problem) throw new Error(problem);
        const q = quoteFor(get().data, input);
        const ref = q.total > 0 ? (await charge(q.total, input.paymentMethod)).ref : null;
        const r = addBooking(get().data, input, ref);
        set({ data: r.data });
        return r.booking;
      },
      async cancel(id) {
        const r = cancelBooking(get().data, id);
        await refund(r.paymentRef, r.refund);
        set({ data: r.data });
        return r.message;
      },
      async changePlan(plan) {
        const d = get().data;
        const price = PLANS[plan].price[d.member.vehicle.size];
        if (price > 0) await charge(price, d.member.defaultPayment);
        set({ data: switchPlan(get().data, plan) });
      },
      updateMember: (patch) => set((s) => ({ data: { ...s.data, member: { ...s.data.member, ...patch } } })),
      reset: () => set({ data: seed() }),
    }),
    {
      name: 'forewheels-v1',
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ data: s.data }),
    },
  ),
);
