// Staff tools: see every booking by day and act on them through the `staff` server function.
import type { Booking, TierId } from '@forewheels/engine';
import { useEffect, useState } from 'react';

import { useSession } from './auth';
import { toBooking, type BookingRow, type UpdateRow } from './bookings';
import { supabase } from './supabase';

/** Is the signed-in account staff? (undefined while checking) */
export function useIsStaff(): boolean | undefined {
  const session = useSession();
  const [checked, setChecked] = useState<{ uid: string; staff: boolean } | null>(null);
  const uid = session?.user && !session.user.is_anonymous ? session.user.id : null;
  useEffect(() => {
    if (!uid) return;
    void supabase.rpc('is_staff').then(({ data }) => setChecked({ uid, staff: !!data }), () => setChecked({ uid, staff: false }));
  }, [uid]);
  if (session === undefined) return undefined;
  if (!uid) return false;
  return checked?.uid === uid ? checked.staff : undefined;
}

/** Bookings with a tee time on the given day, earliest first. */
export async function bookingsForDay(day: Date): Promise<Booking[]> {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data, error } = await supabase.from('bookings').select('*').gte('tee_time', start.toISOString()).lt('tee_time', end.toISOString()).order('tee_time');
  if (error) throw new Error('Could not load bookings. Check your connection.');
  return (data as BookingRow[]).map((r) => toBooking(r));
}

/** One booking with its full timeline, plus the member's gifted washes. */
export async function bookingDetail(id: string): Promise<{ booking: Booking; userId: string | null }> {
  const [b, u] = await Promise.all([
    supabase.from('bookings').select('*').eq('id', id).single(),
    supabase.from('booking_updates').select('id, booking_id, kind, message, by_staff, at').eq('booking_id', id).order('at'),
  ]);
  if (b.error) throw new Error('Could not load this booking.');
  return { booking: toBooking(b.data as BookingRow, (u.data ?? []) as UpdateRow[]), userId: (b.data as BookingRow).user_id };
}

export type StaffAction =
  | { action: 'check_in'; booking_id: string; stall?: string }
  | { action: 'stage'; booking_id: string; stage: string }
  | { action: 'ready'; booking_id: string; message?: string }
  | { action: 'complete'; booking_id: string }
  | { action: 'message'; booking_id: string; message: string }
  | { action: 'refund'; booking_id: string; amount: number; reason: string }
  | { action: 'gift'; booking_id: string; tier: TierId; reason: string }
  | { action: 'cancel'; booking_id: string; reason?: string };

export async function staffAct(body: StaffAction): Promise<void> {
  const { error } = await supabase.functions.invoke('staff', { body });
  if (error) {
    const out = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(out?.error ?? (/fetch|network/i.test(error.message) ? 'No connection. Try again when you have signal.' : 'That didn’t work. Try again.'));
  }
}

/** Reload when any booking or update changes (staff can see them all). */
export function listenToBay(onChange: () => void): () => void {
  const ch = supabase
    .channel(`bay-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_updates' }, onChange)
    .subscribe();
  return () => void supabase.removeChannel(ch);
}
