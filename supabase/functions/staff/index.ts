// Staff actions on bookings: move a car through its steps, message the member, refund, gift a free wash, cancel.
// Only staff accounts can call it. Every action is recorded on the booking's timeline and sent to the member's
// phone as a push notification (when they've allowed notifications).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const TIER_NAME: Record<string, string> = { express: 'Express Wash', signature: 'Signature Detail', pro: 'Pro Detail' };
const STAGES: Record<string, number> = { 'Exterior wash': 0.15, 'Wheels & tires': 0.4, 'Interior clean': 0.65, 'Finishing touches': 0.9 };
const money = (n: number) => `$${n.toFixed(2)}`;

type Action =
  | { action: 'check_in'; booking_id: string; stall?: string }
  | { action: 'stage'; booking_id: string; stage: string }
  | { action: 'ready'; booking_id: string; message?: string }
  | { action: 'complete'; booking_id: string }
  | { action: 'message'; booking_id: string; message: string }
  | { action: 'refund'; booking_id: string; amount: number; reason: string }
  | { action: 'gift'; booking_id?: string; user_id?: string; tier: string; reason: string }
  | { action: 'cancel'; booking_id: string; reason?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: who } = await asUser.auth.getUser();
    if (!who.user) return json({ error: 'Sign in first.' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: me } = await db.from('staff').select('role, display_name').eq('user_id', who.user.id).maybeSingle();
    if (!me) return json({ error: 'Staff only.' }, 403);
    const staffId = who.user.id;
    const a = (await req.json().catch(() => ({}))) as Action;

    const getBooking = async (id?: string) => {
      if (!id) throw new HttpError(400, 'Choose a booking.');
      const { data } = await db.from('bookings').select('*').eq('id', id).maybeSingle();
      if (!data) throw new HttpError(404, 'Booking not found.');
      return data;
    };
    const log = async (booking: { id: string; user_id: string | null }, kind: string, message: string) => {
      await db.from('booking_updates').insert({ booking_id: booking.id, user_id: booking.user_id, kind, message, by_staff: staffId });
      if (booking.user_id) await push(db, booking.user_id, message, { booking_id: booking.id, kind });
    };
    const update = async (id: string, patch: Record<string, unknown>) => {
      const { data, error } = await db.from('bookings').update(patch).eq('id', id).select('*').single();
      if (error) throw new HttpError(500, error.message);
      return data;
    };

    switch (a.action) {
      case 'check_in': {
        const b = await getBooking(a.booking_id);
        if (b.status !== 'booked') throw new HttpError(409, 'Only booked cars can be checked in.');
        const stall = (a.stall ?? b.stall ?? '').toUpperCase();
        const row = await update(b.id, { status: 'in_progress', checked_in_at: new Date().toISOString(), stage: 'Exterior wash', progress: STAGES['Exterior wash'], stall });
        await log(b, 'checked_in', `We've got your car${stall ? ` in stall ${stall}` : ''} and started your ${TIER_NAME[b.tier]}. Enjoy the round.`);
        return json({ booking: row });
      }
      case 'stage': {
        const b = await getBooking(a.booking_id);
        if (b.status !== 'in_progress') throw new HttpError(409, 'Check the car in first.');
        if (!(a.stage in STAGES)) throw new HttpError(400, 'Unknown step.');
        const row = await update(b.id, { stage: a.stage, progress: STAGES[a.stage] });
        await log(b, 'stage', `${a.stage} in progress.`);
        return json({ booking: row });
      }
      case 'ready': {
        const b = await getBooking(a.booking_id);
        if (!['in_progress', 'booked'].includes(b.status)) throw new HttpError(409, 'This booking is already finished.');
        const row = await update(b.id, { status: 'ready', ready_at: new Date().toISOString(), stage: 'Ready', progress: 1, checked_in_at: b.checked_in_at ?? new Date().toISOString() });
        await log(b, 'ready', a.message?.trim() || `Your car is ready${b.keys === 'proshop' ? '. Keys are at the pro shop.' : '.'}`);
        return json({ booking: row });
      }
      case 'complete': {
        const b = await getBooking(a.booking_id);
        const row = await update(b.id, { status: 'completed', completed_at: new Date().toISOString(), progress: 1 });
        await db.from('booking_updates').insert({ booking_id: b.id, user_id: b.user_id, kind: 'completed', message: 'Picked up. Thanks for choosing Fore Wheels.', by_staff: staffId });
        return json({ booking: row });
      }
      case 'message': {
        const b = await getBooking(a.booking_id);
        const text = (a.message ?? '').trim().slice(0, 300);
        if (!text) throw new HttpError(400, 'Write a message first.');
        await log(b, 'message', text);
        return json({ ok: true });
      }
      case 'refund': {
        const b = await getBooking(a.booking_id);
        const amount = Math.round(Number(a.amount) * 100) / 100;
        const left = Math.round((Number(b.paid) - Number(b.refund)) * 100) / 100;
        if (!(amount > 0)) throw new HttpError(400, 'Enter an amount to refund.');
        if (amount > left) throw new HttpError(400, `You can refund up to ${money(left)} on this booking.`);
        if (!a.reason?.trim()) throw new HttpError(400, 'Add a short reason.');
        // Payment refund: stand-in until Stripe and club billing are connected (the payment reference is kept).
        const row = await update(b.id, { refund: Number(b.refund) + amount, refund_reason: a.reason.trim().slice(0, 200) });
        await log(b, 'refund', `We've refunded ${money(amount)}. ${a.reason.trim()}`);
        return json({ booking: row });
      }
      case 'gift': {
        if (!(a.tier in TIER_NAME)) throw new HttpError(400, 'Choose which wash to gift.');
        if (!a.reason?.trim()) throw new HttpError(400, 'Add a short note for the member.');
        const b = a.booking_id ? await getBooking(a.booking_id) : null;
        const uid = b?.user_id ?? a.user_id;
        if (!uid) throw new HttpError(400, 'This booking’s account no longer exists.');
        await db.from('memberships').upsert({ user_id: uid }, { onConflict: 'user_id', ignoreDuplicates: true });
        const { data: m } = await db.from('memberships').select('gifts').eq('user_id', uid).single();
        const gifts = { ...(m?.gifts ?? {}), [a.tier]: Number(m?.gifts?.[a.tier] ?? 0) + 1 };
        await db.from('memberships').update({ gifts, updated_at: new Date().toISOString() }).eq('user_id', uid);
        await db.from('credit_grants').insert({ user_id: uid, tier: a.tier, qty: 1, reason: a.reason.trim().slice(0, 200), booking_id: b?.id ?? null, granted_by: staffId });
        const msg = `A free ${TIER_NAME[a.tier]} is on us. ${a.reason.trim()} It’s in your account for your next booking.`;
        if (b) await log(b, 'gift', msg);
        else await push(db, uid, msg, { kind: 'gift' });
        return json({ ok: true, gifts });
      }
      case 'cancel': {
        const b = await getBooking(a.booking_id);
        if (!['booked', 'in_progress'].includes(b.status)) throw new HttpError(409, 'This booking can’t be cancelled now.');
        const back = Math.round((Number(b.paid) - Number(b.refund)) * 100) / 100;
        if (b.used_credit && b.user_id) {
          const { data: m } = await db.from('memberships').select('credits, gifts').eq('user_id', b.user_id).single();
          if (b.credit_source === 'gift') {
            await db.from('memberships').update({ gifts: { ...(m?.gifts ?? {}), [b.tier]: Number(m?.gifts?.[b.tier] ?? 0) + 1 } }).eq('user_id', b.user_id);
          } else if (m?.credits?.[b.tier]) {
            const c = m.credits[b.tier];
            await db.from('memberships').update({ credits: { ...m.credits, [b.tier]: { ...c, used: Math.max(0, Number(c.used) - 1) } } }).eq('user_id', b.user_id);
          }
        }
        const row = await update(b.id, { status: 'cancelled', cancelled_by: 'staff', refund: Number(b.refund) + back });
        const why = a.reason?.trim() ? ` ${a.reason.trim()}` : '';
        await log(b, 'cancelled', `We've cancelled your ${TIER_NAME[b.tier]}.${why} ${b.used_credit ? 'Your free wash is back in your account.' : `${money(back)} is refunded.`}`);
        return json({ booking: row });
      }
      default:
        return json({ error: 'Unknown action.' }, 400);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('staff', e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  }
});

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Send a push notification to every phone the member has signed in on. Never fails the action. */
async function push(db: ReturnType<typeof createClient>, userId: string, body: string, data: Record<string, unknown>) {
  try {
    const { data: rows } = await db.from('push_tokens').select('token').eq('user_id', userId);
    const tokens = (rows ?? []).map((r: { token: string }) => r.token).filter((t: string) => t.startsWith('ExponentPushToken'));
    if (!tokens.length) return;
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map((to: string) => ({ to, title: 'Fore Wheels', body, data, sound: 'default' }))),
    });
    // Forget phones that no longer accept notifications.
    const out = await res.json().catch(() => null);
    const dead = (out?.data ?? []).map((r: { details?: { error?: string } }, i: number) => (r?.details?.error === 'DeviceNotRegistered' ? tokens[i] : null)).filter(Boolean);
    if (dead.length) await db.from('push_tokens').delete().eq('user_id', userId).in('token', dead);
  } catch (e) {
    console.error('push', e);
  }
}
