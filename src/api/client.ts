// Local stand-in for the Fore Wheels backend. Every function is async and
// returns fresh data, so screens won't change when this file is swapped for
// real HTTP calls. Data persists in the browser's localStorage between visits.

import { PLANS, PlanId, TIERS } from '../data/catalog';
import { cancelTerms, quote } from '../lib/pricing';
import { charge, refund } from './payments';
import type { AppData, Booking, Member, NewBooking } from './types';

const KEY = 'fore-wheels:v1';
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
let memory: AppData | null = null;

function at(daysFromToday: number, hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

export function seed(): AppData {
  const credits = clone(PLANS.monthly.credits);
  credits.express!.used = 1;
  credits.signature!.used = 1;
  const renews = new Date();
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
      {
        id: 'b-1001', tier: 'signature', size: 'suv', teeTime: minutesAgo(80), stall: 'B-14', keys: 'proshop',
        addons: [], status: 'in_progress', paid: 0, usedCredit: true, paymentMethod: null, paymentRef: null,
        checkedInAt: minutesAgo(70), createdAt: minutesAgo(60 * 48),
      },
      {
        id: 'b-1002', tier: 'express', size: 'suv', teeTime: at(1, '07:20'), stall: '', keys: 'unlocked',
        addons: [], status: 'booked', paid: 0, usedCredit: true, paymentMethod: null, paymentRef: null,
        createdAt: minutesAgo(60 * 20),
      },
      {
        id: 'b-0990', tier: 'pro', size: 'suv', teeTime: at(-12, '08:00'), stall: 'A-02', keys: 'proshop',
        addons: ['pet'], status: 'completed', paid: 304.92, usedCredit: false, paymentMethod: 'club', paymentRef: 'CLUB-7Q2K1D',
        createdAt: at(-15, '19:00'),
      },
      {
        id: 'b-0981', tier: 'express', size: 'suv', teeTime: at(-19, '07:40'), stall: 'C-08', keys: 'unlocked',
        addons: [], status: 'completed', paid: 0, usedCredit: true, paymentMethod: null, paymentRef: null,
        createdAt: at(-20, '12:00'),
      },
    ],
  };
}

function load(): AppData {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (memory = JSON.parse(raw));
  } catch { /* storage unavailable: run in memory */ }
  return (memory = seed());
}
function save(d: AppData) {
  memory = d;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

export async function getData(): Promise<AppData> {
  await wait(150);
  return clone(load());
}

export async function createBooking(input: NewBooking): Promise<{ data: AppData; booking: Booking }> {
  const d = load();
  const m = d.member;
  const q = quote({ tier: input.tier, size: input.size, addons: input.addons, plan: m.plan, credits: m.credits });
  if (new Date(input.teeTime).getTime() < Date.now()) throw new Error('That tee time has already passed. Pick a later time.');
  let ref: string | null = null;
  if (q.total > 0) ref = (await charge(q.total, input.paymentMethod)).ref;
  else await wait(400);
  if (q.usesCredit) m.credits[input.tier]!.used += 1;
  const booking: Booking = {
    id: 'b-' + Math.floor(Math.random() * 9000 + 1000),
    tier: input.tier, size: input.size, teeTime: input.teeTime, stall: input.stall.trim().toUpperCase(),
    keys: input.keys, addons: input.addons, status: 'booked', paid: q.total, usedCredit: q.usesCredit,
    paymentMethod: q.total > 0 ? input.paymentMethod : null, paymentRef: ref, createdAt: new Date().toISOString(),
  };
  d.bookings.push(booking);
  m.defaultPayment = input.paymentMethod;
  save(d);
  return { data: clone(d), booking: clone(booking) };
}

export async function cancelBooking(id: string): Promise<{ data: AppData; message: string }> {
  const d = load();
  const b = d.bookings.find((x) => x.id === id);
  if (!b) throw new Error('Booking not found.');
  const terms = cancelTerms(b);
  if (terms.kind === 'closed') throw new Error('This booking can no longer be cancelled.');
  await refund(b.paymentRef, terms.refund);
  if (terms.kind === 'free' && terms.returnsCredit) {
    const c = d.member.credits[b.tier];
    if (c) c.used = Math.max(0, c.used - 1);
  }
  b.status = 'cancelled';
  b.refund = terms.refund;
  save(d);
  const message = terms.kind === 'free'
    ? terms.returnsCredit ? 'Cancelled. Your pass credit is back.' : `Cancelled. ${fmt(terms.refund)} refunded.`
    : b.usedCredit ? 'Cancelled. The pass credit was used.' : `Cancelled. ${fmt(terms.refund)} refunded after the late fee.`;
  return { data: clone(d), message };
}

export async function changePlan(plan: PlanId): Promise<AppData> {
  const d = load();
  const m = d.member;
  const price = PLANS[plan].price[m.vehicle.size];
  if (price > 0) await charge(price, m.defaultPayment);
  else await wait(300);
  m.plan = plan;
  m.credits = clone(PLANS[plan].credits);
  save(d);
  return clone(d);
}

export async function updateMember(patch: Partial<Member>): Promise<AppData> {
  const d = load();
  d.member = { ...d.member, ...patch };
  save(d);
  await wait(100);
  return clone(d);
}

/** Moves the demo forward: in-progress jobs finish once their time is up. */
export function tick(d: AppData, now = Date.now()): AppData {
  let changed = false;
  for (const b of d.bookings) {
    if (b.status === 'in_progress' && b.checkedInAt) {
      const done = new Date(b.checkedInAt).getTime() + TIERS[b.tier].minutes * 60000;
      if (now >= done) { b.status = 'ready'; changed = true; }
    }
  }
  if (changed) save(clone(d));
  return d;
}

export async function resetDemo(): Promise<AppData> {
  const d = seed();
  save(d);
  await wait(100);
  return clone(d);
}

const fmt = (n: number) => '$' + n.toFixed(2);
