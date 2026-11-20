import {
  ADDONS, AddonId, Credits, FREE_CANCEL_HOURS, GST_RATE, LATE_CANCEL_FEE,
  PLANS, PlanId, TIERS, TierId, VehicleSize,
} from './catalog';

export interface QuoteInput {
  tier: TierId;
  size: VehicleSize;
  addons: AddonId[];
  plan: PlanId;
  credits: Credits;
}

export interface QuoteLine { label: string; amount: number; note?: string }

export interface Quote {
  lines: QuoteLine[];
  usesCredit: boolean;
  subtotal: number;
  gst: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function hasCredit(credits: Credits, tier: TierId): boolean {
  const c = credits[tier];
  return !!c && c.used < c.of;
}

export function addonAllowed(id: AddonId, tier: TierId): boolean {
  const a = ADDONS.find((x) => x.id === id);
  return !!a && (!a.onlyFor || a.onlyFor.includes(tier));
}

export function quote({ tier, size, addons, plan, credits }: QuoteInput): Quote {
  const p = PLANS[plan];
  const t = TIERS[tier];
  const lines: QuoteLine[] = [];
  const usesCredit = plan !== 'payg' && hasCredit(credits, tier);

  if (usesCredit) {
    lines.push({ label: t.name, amount: 0, note: `${p.name} credit` });
  } else {
    const disc = p.discountTiers.includes(tier) ? p.discount : 0;
    lines.push({
      label: t.name,
      amount: round2(t.price[size] * (1 - disc)),
      note: disc ? `${Math.round(disc * 100)}% pass discount` : undefined,
    });
  }

  for (const id of addons) {
    if (!addonAllowed(id, tier)) continue;
    const a = ADDONS.find((x) => x.id === id)!;
    lines.push({ label: a.name, amount: round2(a.price * (1 - p.discount)) });
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const gst = round2(subtotal * GST_RATE);
  return { lines, usesCredit, subtotal, gst, total: round2(subtotal + gst) };
}

export type CancelTerms =
  | { kind: 'free'; refund: number; returnsCredit: boolean }
  | { kind: 'late'; fee: number; refund: number; returnsCredit: false }
  | { kind: 'closed' };

/** Free up to FREE_CANCEL_HOURS before tee time. Later: credit is used, or a fee is kept. */
export function cancelTerms(b: { teeTime: string; status: string; paid: number; usedCredit: boolean }, now = new Date()): CancelTerms {
  if (b.status !== 'booked') return { kind: 'closed' };
  const hoursLeft = (new Date(b.teeTime).getTime() - now.getTime()) / 36e5;
  if (hoursLeft >= FREE_CANCEL_HOURS) return { kind: 'free', refund: b.paid, returnsCredit: b.usedCredit };
  if (b.usedCredit) return { kind: 'late', fee: 0, refund: 0, returnsCredit: false };
  const fee = Math.min(LATE_CANCEL_FEE, b.paid);
  return { kind: 'late', fee, refund: round2(b.paid - fee), returnsCredit: false };
}

export const money = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' });
export const dollars = (n: number) => '$' + n.toLocaleString('en-CA');
