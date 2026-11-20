// The booking rules as plain functions on the member's data. Each app keeps the data
// (in the browser or on the phone) and calls these, so the web and iOS apps behave the same.
// When a real server exists, the same functions can run there instead.

import { PLANS, TIERS, type PlanId } from './catalog';
import { cancelTerms, quote, type Quote } from './pricing';
import type { AppData, Booking, Member, NewBooking, NewMemberDetails, PaymentMethod } from './types';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function at(now: number, daysFromToday: number, hhmm: string): string {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromToday);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Sample member for demos and first launch, with times relative to `now`. */
export function seed(now = Date.now()): AppData {
  const ago = (m: number) => new Date(now - m * 60000).toISOString();
  const credits = clone(PLANS.monthly.credits);
  credits.express!.used = 1;
  credits.signature!.used = 1;
  const renews = new Date(now);
  renews.setMonth(renews.getMonth() + 1, 1);
  return {
    member: {
      firstName: 'Alex',
      club: 'Example Golf & Country Club',
      memberNo: '4471',
      vehicle: { label: '2023 Audi Q5', plate: 'CKR 4471', size: 'suv' },
      plan: 'monthly',
      planRenews: renews.toISOString(),
      credits,
      defaultPayment: 'club',
      card: { brand: 'Visa', last4: '4242', exp: '08/28' },
      notify: { started: true, ready: true, reminders: false },
    },
    bookings: [
      { id: 'b-1001', tier: 'signature', size: 'suv', teeTime: ago(80), stall: 'B-14', keys: 'proshop', addons: [], status: 'in_progress', paid: 0, usedCredit: true, paymentMethod: null, paymentRef: null, checkedInAt: ago(70), createdAt: ago(60 * 48) },
      { id: 'b-1002', tier: 'express', size: 'suv', teeTime: at(now, 1, '07:20'), stall: '', keys: 'unlocked', addons: [], status: 'booked', paid: 0, usedCredit: true, paymentMethod: null, paymentRef: null, createdAt: ago(60 * 20) },
      { id: 'b-0990', tier: 'pro', size: 'suv', teeTime: at(now, -12, '08:00'), stall: 'A-02', keys: 'proshop', addons: ['pet'], status: 'completed', paid: 304.92, usedCredit: false, paymentMethod: 'club', paymentRef: 'CLUB-7Q2K1D', createdAt: at(now, -15, '19:00') },
      { id: 'b-0981', tier: 'express', size: 'suv', teeTime: at(now, -19, '07:40'), stall: 'C-08', keys: 'unlocked', addons: [], status: 'completed', paid: 0, usedCredit: true, paymentMethod: null, paymentRef: null, createdAt: at(now, -20, '12:00') },
    ],
  };
}

/** A brand-new member: pay as you go, no bookings, no saved card. Guests use this with an empty name. */
export function newMember(details: NewMemberDetails = { firstName: '' }, now = Date.now()): AppData {
  const renews = new Date(now);
  renews.setMonth(renews.getMonth() + 1, 1);
  const memberNo = details.memberNo?.trim() ?? '';
  return {
    member: {
      firstName: details.firstName.trim(),
      lastName: details.lastName?.trim() || undefined,
      club: details.club?.trim() ?? '',
      memberNo,
      vehicle: details.vehicle ?? { label: '', plate: '', size: 'car' },
      plan: 'payg',
      planRenews: renews.toISOString(),
      credits: {},
      defaultPayment: memberNo ? 'club' : 'apple',
      card: null,
      notify: { started: true, ready: true, reminders: false },
    },
    bookings: [],
  };
}

/** Payment methods this member can use, in display order. */
export function paymentMethods(m: Member): PaymentMethod[] {
  return [...(m.memberNo ? (['club'] as const) : []), 'apple', ...(m.card ? (['card'] as const) : [])];
}

export function quoteFor(d: AppData, input: Pick<NewBooking, 'tier' | 'size' | 'addons'>): Quote {
  return quote({ ...input, plan: d.member.plan, credits: d.member.credits, gifts: d.member.gifts });
}

/** Checks a booking before payment. Returns an error message, or null when it's fine. */
export function checkBooking(input: NewBooking, now = Date.now()): string | null {
  if (new Date(input.teeTime).getTime() < now) return 'That tee time has already passed. Pick a later time.';
  return null;
}

/** Records a booking after payment (or a pass credit) went through. */
export function addBooking(d: AppData, input: NewBooking, paymentRef: string | null, now = Date.now()): { data: AppData; booking: Booking } {
  const next = clone(d);
  const q = quoteFor(next, input);
  if (q.creditSource === 'plan') next.member.credits[input.tier]!.used += 1;
  if (q.creditSource === 'gift') next.member.gifts = { ...next.member.gifts, [input.tier]: (next.member.gifts?.[input.tier] ?? 1) - 1 };
  const booking: Booking = {
    id: 'b-' + now.toString(36) + Math.floor(Math.random() * 1000),
    tier: input.tier, size: input.size, teeTime: input.teeTime, stall: input.stall.trim().toUpperCase(),
    keys: input.keys, addons: input.addons, status: 'booked', paid: q.total, usedCredit: q.usesCredit, creditSource: q.creditSource,
    paymentMethod: q.total > 0 ? input.paymentMethod : null, paymentRef, createdAt: new Date(now).toISOString(),
  };
  next.bookings.push(booking);
  next.member.defaultPayment = input.paymentMethod;
  return { data: next, booking };
}

export function cancelBooking(d: AppData, id: string, now = Date.now()): { data: AppData; message: string; refund: number; paymentRef: string | null } {
  const next = clone(d);
  const b = next.bookings.find((x) => x.id === id);
  if (!b) throw new Error('Booking not found.');
  const terms = cancelTerms(b, new Date(now));
  if (terms.kind === 'closed') throw new Error('This booking can no longer be cancelled.');
  if (terms.kind === 'free' && terms.returnsCredit) {
    if (b.creditSource === 'gift') {
      next.member.gifts = { ...next.member.gifts, [b.tier]: (next.member.gifts?.[b.tier] ?? 0) + 1 };
    } else {
      const c = next.member.credits[b.tier];
      if (c) c.used = Math.max(0, c.used - 1);
    }
  }
  b.status = 'cancelled';
  b.refund = terms.refund;
  const fmt = (n: number) => '$' + n.toFixed(2);
  const message = terms.kind === 'free'
    ? terms.returnsCredit ? 'Cancelled. Your pass credit is back.' : `Cancelled. ${fmt(terms.refund)} refunded.`
    : b.usedCredit ? 'Cancelled. The pass credit was used.' : `Cancelled. ${fmt(terms.refund)} refunded after the late fee.`;
  return { data: next, message, refund: terms.refund, paymentRef: b.paymentRef };
}

export function switchPlan(d: AppData, plan: PlanId): AppData {
  const next = clone(d);
  next.member.plan = plan;
  next.member.credits = clone(PLANS[plan].credits);
  return next;
}

/** Moves in-progress jobs to "ready" once their time is up. Returns the same object when nothing changed. */
export function advance(d: AppData, now = Date.now()): AppData {
  const due = d.bookings.some((b) => b.status === 'in_progress' && b.checkedInAt &&
    now >= new Date(b.checkedInAt).getTime() + TIERS[b.tier].minutes * 60000);
  if (!due) return d;
  const next = clone(d);
  for (const b of next.bookings) {
    if (b.status === 'in_progress' && b.checkedInAt && now >= new Date(b.checkedInAt).getTime() + TIERS[b.tier].minutes * 60000) b.status = 'ready';
  }
  return next;
}

/** Stand-in for live availability: a few slots each day show as full. */
export function slotFull(day: Date, hhmm: string): boolean {
  return (day.getDate() * 31 + Number(hhmm.replace(':', ''))) % 7 === 0;
}
