import { TIERS } from '../data/catalog';
import type { Booking } from '../api/types';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function clock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
export const shortClock = (d: Date) => clock(d).replace(/ (AM|PM)$/, '');

/** "7:20" style label for a "07:20" tee-time slot. */
export function slotLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}

export const dayShort = (d: Date) => DAY[d.getDay()];
export const longDate = (d: Date) => `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`;
export const medDate = (d: Date) => `${DAY[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
export const monthDay = (d: Date) => `${MONTH[d.getMonth()]} ${d.getDate()}`;

export function relDay(d: Date, now = new Date()): string {
  if (sameDay(d, now)) return 'Today';
  const t = new Date(now); t.setDate(t.getDate() + 1);
  if (sameDay(d, t)) return 'Tomorrow';
  return medDate(d);
}

export function atSlot(day: Date, hhmm: string): Date {
  const d = new Date(day);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export const STAGES = ['Exterior wash', 'Wheels & tires', 'Interior clean', 'Finishing touches'];

export function progress(b: Booking, now = Date.now()) {
  if (b.status === 'ready' || b.status === 'completed') return { pct: 1, stage: 'Ready for pickup', readyAt: null as Date | null };
  if (b.status !== 'in_progress' || !b.checkedInAt) return { pct: 0, stage: 'Booked', readyAt: null as Date | null };
  const start = new Date(b.checkedInAt).getTime();
  const total = TIERS[b.tier].minutes * 60000;
  const pct = Math.min(0.99, Math.max(0, (now - start) / total));
  const stage = pct < 0.25 ? STAGES[0] : pct < 0.45 ? STAGES[1] : pct < 0.8 ? STAGES[2] : STAGES[3];
  return { pct, stage, readyAt: new Date(start + total) };
}
