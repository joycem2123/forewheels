// Members' bookings, pass and gifted washes live on the server, so staff can see and update them.
// The phone keeps a copy (for offline viewing) and listens for live changes.
import type { AppData, Booking, BookingUpdate, Credits, Gifts, NewBooking, PlanId, Quote, UpdateKind } from '@forewheels/engine';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { GUEST_KEY, useStore } from '@/store/store';
import { supabase } from './supabase';

export interface BookingRow {
  id: string; user_id: string | null; tier: Booking['tier']; size: Booking['size']; tee_time: string; stall: string;
  keys: Booking['keys']; addons: Booking['addons']; status: Booking['status']; stage: string | null; progress: number | null;
  paid: number; used_credit: boolean; credit_source: 'plan' | 'gift' | null; payment_method: Booking['paymentMethod'];
  payment_ref: string | null; checked_in_at: string | null; ready_at: string | null; refund: number; refund_reason: string | null;
  member_name: string | null; vehicle_label: string | null; created_at: string;
}
export interface UpdateRow { id: number; booking_id: string; kind: UpdateKind; message: string; by_staff: string | null; at: string }

export const toBooking = (r: BookingRow, updates: UpdateRow[] = []): Booking => ({
  id: r.id, tier: r.tier, size: r.size, teeTime: r.tee_time, stall: r.stall, keys: r.keys, addons: r.addons ?? [],
  status: r.status, stage: r.stage, progress: r.progress == null ? null : Number(r.progress), paid: Number(r.paid),
  usedCredit: r.used_credit, creditSource: r.credit_source, paymentMethod: r.payment_method, paymentRef: r.payment_ref,
  checkedInAt: r.checked_in_at ?? undefined, readyAt: r.ready_at ?? undefined, refund: Number(r.refund) || undefined,
  refundReason: r.refund_reason ?? undefined, memberName: r.member_name, vehicleLabel: r.vehicle_label, createdAt: r.created_at,
  updates: updates.filter((u) => u.booking_id === r.id).map(toUpdate),
});
const toUpdate = (u: UpdateRow): BookingUpdate => ({ id: String(u.id), at: u.at, kind: u.kind, message: u.message, byStaff: !!u.by_staff });

const friendly = (m: string) =>
  m === 'no_credit' ? 'That free wash has already been used. Pick a paid service or another level.'
    : m === 'tee_time_passed' ? 'That tee time has already passed. Pick a later time.'
      : m === 'cannot_cancel' ? 'This booking can no longer be cancelled.'
        : m === 'account_needed' ? 'Create a free account to book.'
          : /fetch|network/i.test(m) ? 'No connection. Try again when you have signal.'
            : 'Something went wrong. Try again.';

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  return u && !u.is_anonymous ? u.id : null;
}

/** Load my bookings, their timelines, and my pass into the phone's copy. */
export async function pullMine(): Promise<void> {
  const uid = await myId();
  if (!uid || useStore.getState().accountKey === GUEST_KEY) return;
  const [b, u, m] = await Promise.all([
    supabase.from('bookings').select('*').eq('user_id', uid).order('tee_time', { ascending: true }),
    supabase.from('booking_updates').select('id, booking_id, kind, message, by_staff, at').eq('user_id', uid).order('at', { ascending: true }),
    supabase.rpc('my_membership'),
  ]);
  if (b.error || u.error || m.error) return;
  const st = useStore.getState();
  const d: AppData = st.data;
  const ms = m.data as { plan: PlanId; plan_renews: string | null; credits: Credits; gifts: Gifts };
  const next: AppData = {
    bookings: (b.data as BookingRow[]).map((r) => toBooking(r, u.data as UpdateRow[])),
    member: { ...d.member, plan: ms.plan, planRenews: ms.plan_renews ?? d.member.planRenews, credits: ms.credits ?? {}, gifts: ms.gifts ?? {} },
  };
  useStore.setState((s) => ({ data: next, accounts: { ...s.accounts, [s.accountKey]: next } }));
}

/** Book online. Payment (if any) has already been taken; `ref` is its reference. */
export async function bookOnline(input: NewBooking, q: Quote, ref: string | null): Promise<Booking> {
  const { data, error } = await supabase.rpc('create_booking', {
    b: {
      tier: input.tier, size: input.size, tee_time: input.teeTime, stall: input.stall, keys: input.keys, addons: input.addons,
      used_credit: q.usesCredit, paid: q.total, payment_method: q.total > 0 ? input.paymentMethod : null, payment_ref: ref,
    },
  });
  if (error) throw new Error(friendly(error.message));
  await pullMine();
  return toBooking(data as BookingRow);
}

export async function cancelOnline(id: string): Promise<{ message: string; refund: number; paymentRef: string | null }> {
  const { data, error } = await supabase.rpc('cancel_booking', { booking: id });
  if (error) throw new Error(friendly(error.message));
  await pullMine();
  return { message: data.message, refund: Number(data.refund), paymentRef: data.payment_ref };
}

export async function setPlanOnline(plan: PlanId): Promise<void> {
  const { error } = await supabase.rpc('set_plan', { p: plan });
  if (error) throw new Error(friendly(error.message));
  await pullMine();
}

/** Listen for staff updates to my bookings and pass; show each new message as a banner. */
export function listenToMine(uid: string): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`member-${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${uid}` }, () => void pullMine())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships', filter: `user_id=eq.${uid}` }, () => void pullMine())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_updates', filter: `user_id=eq.${uid}` }, (p) => {
      const row = p.new as UpdateRow;
      if (row.by_staff) useStore.getState().notify(row.message);
      void pullMine();
    })
    .subscribe();
  return () => void supabase.removeChannel(channel);
}
