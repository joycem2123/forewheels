// Local stand-in for the Fore Wheels backend: the booking rules come from the shared engine,
// and the member's data is kept in the browser. Swap these functions for server calls later.

import { addBooking, advance, cancelBooking as cancelRule, checkBooking, PLANS, quoteFor, seed, switchPlan, type AppData, type Booking, type Member, type NewBooking, type PlanId } from '@forewheels/engine';
import { charge, refund } from './payments';

const KEY = 'fore-wheels:v1';
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
let memory: AppData | null = null;

function load(): AppData {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (memory = JSON.parse(raw));
  } catch { /* storage unavailable: run in memory */ }
  return (memory = seed());
}
function save(d: AppData): AppData {
  memory = d;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
  return d;
}

export async function getData(): Promise<AppData> {
  await wait(150);
  return save(advance(load()));
}

export async function createBooking(input: NewBooking): Promise<{ data: AppData; booking: Booking }> {
  const problem = checkBooking(input);
  if (problem) throw new Error(problem);
  const q = quoteFor(load(), input);
  const ref = q.total > 0 ? (await charge(q.total, input.paymentMethod)).ref : (await wait(400), null);
  const r = addBooking(load(), input, ref);
  save(r.data);
  return r;
}

export async function cancelBooking(id: string): Promise<{ data: AppData; message: string }> {
  const r = cancelRule(load(), id);
  await refund(r.paymentRef, r.refund);
  return { data: save(r.data), message: r.message };
}

export async function changePlan(plan: PlanId): Promise<AppData> {
  const d = load();
  const price = PLANS[plan].price[d.member.vehicle.size];
  if (price > 0) await charge(price, d.member.defaultPayment); else await wait(300);
  return save(switchPlan(load(), plan));
}

export async function updateMember(patch: Partial<Member>): Promise<AppData> {
  const d = load();
  await wait(100);
  return save({ ...d, member: { ...d.member, ...patch } });
}

export const tick = (d: AppData): AppData => (advance(d) === d ? d : save(advance(d)));

export async function resetDemo(): Promise<AppData> {
  await wait(100);
  return save(seed());
}
