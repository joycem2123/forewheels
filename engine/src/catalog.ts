// Service menu and pass pricing. All prices CAD, before 5% GST.
// Change prices here; every screen and the checkout read from this file.

export type VehicleSize = 'car' | 'suv';
export type TierId = 'express' | 'signature' | 'pro';
export type PlanId = 'payg' | 'monthly' | 'season';
export type AddonId = 'pet' | 'odour' | 'ceramic' | 'headlight';

export interface Tier {
  id: TierId;
  level: 1 | 2 | 3;
  name: string;
  minutes: number;
  price: Record<VehicleSize, number>;
  includes: string[];
  note?: string;
}

export const TIERS: Record<TierId, Tier> = {
  express: {
    id: 'express',
    level: 1,
    name: 'Express Wash',
    minutes: 45,
    price: { car: 59, suv: 69 },
    includes: ['Waterless hand wash', 'Wheels, tires & tire shine', 'Exterior glass', 'Quick interior vacuum & wipe'],
    note: 'Fits a 9-hole round.',
  },
  signature: {
    id: 'signature',
    level: 2,
    name: 'Signature Detail',
    minutes: 120,
    price: { car: 149, suv: 169 },
    includes: ['Everything in Express', 'Full interior vacuum & mats', 'Dash, console & door panels', 'Interior glass & door jambs', 'Spray sealant'],
  },
  pro: {
    id: 'pro',
    level: 3,
    name: 'Pro Detail',
    minutes: 210,
    price: { car: 259, suv: 289 },
    includes: ['Everything in Signature', 'Leather clean & condition', 'Steam stain extraction', 'Iron decon on wheels', '3-month ceramic spray coat'],
    note: 'About 3.5 hours. 18-hole rounds only.',
  },
};

export const TIER_ORDER: TierId[] = ['express', 'signature', 'pro'];

export interface Addon {
  id: AddonId;
  name: string;
  price: number;
  onlyFor?: TierId[];
}

export const ADDONS: Addon[] = [
  { id: 'pet', name: 'Pet hair removal', price: 35 },
  { id: 'odour', name: 'Odour treatment', price: 45 },
  { id: 'ceramic', name: 'Ceramic upgrade', price: 49, onlyFor: ['signature'] },
  { id: 'headlight', name: 'Headlight restoration', price: 69 },
];

export type Credits = Partial<Record<TierId, { used: number; of: number }>>;

export interface Plan {
  id: PlanId;
  name: string;
  price: Record<VehicleSize, number>;
  period: string;
  retailValue?: Record<VehicleSize, number>;
  /** Discount on services not covered by credits, and on add-ons. */
  discount: number;
  /** Discount applies to these tiers when paid (credits cover the rest). */
  discountTiers: TierId[];
  credits: Credits;
  includes: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  payg: {
    id: 'payg',
    name: 'Pay as you go',
    price: { car: 0, suv: 0 },
    period: '',
    discount: 0,
    discountTiers: [],
    credits: {},
    includes: ['List price per service', 'No commitment', 'Free cancellation up to 2 hrs before tee time'],
  },
  monthly: {
    id: 'monthly',
    name: 'Monthly Pass',
    price: { car: 229, suv: 259 },
    period: 'month',
    retailValue: { car: 385, suv: 445 },
    discount: 0.1,
    discountTiers: ['pro'],
    credits: { express: { used: 0, of: 4 }, signature: { used: 0, of: 1 } },
    includes: ['4 Express Washes a month', '1 Signature Detail a month', '10% off Pro Details & extras', 'Cancel anytime'],
  },
  season: {
    id: 'season',
    name: 'Season Pass',
    price: { car: 1195, suv: 1345 },
    period: 'season',
    retailValue: { car: 2184, suv: 2459 },
    discount: 0.15,
    discountTiers: ['express', 'signature', 'pro'],
    credits: { express: { used: 0, of: 20 }, signature: { used: 0, of: 5 }, pro: { used: 0, of: 1 } },
    includes: ['May 1 – Oct 15', 'Opening-day Pro Detail', '1 Signature Detail a month (Jun–Oct)', 'Up to 20 Express Washes', '15% off extras'],
  },
};

export const PLAN_ORDER: PlanId[] = ['payg', 'monthly', 'season'];

export const GST_RATE = 0.05;
export const FREE_CANCEL_HOURS = 2;
export const LATE_CANCEL_FEE = 20;

export const TEE_TIMES = ['07:00', '07:20', '07:40', '08:00', '08:20', '08:40', '09:00', '09:20', '09:40', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'];
