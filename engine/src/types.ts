import type { AddonId, Credits, PlanId, TierId, VehicleSize } from './catalog';

export type BookingStatus = 'booked' | 'in_progress' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'club' | 'apple' | 'card';
export type KeyHandoff = 'unlocked' | 'proshop';

export interface Booking {
  id: string;
  tier: TierId;
  size: VehicleSize;
  /** ISO date-time of the member's tee time. */
  teeTime: string;
  stall: string;
  keys: KeyHandoff;
  addons: AddonId[];
  status: BookingStatus;
  paid: number;
  usedCredit: boolean;
  paymentMethod: PaymentMethod | null;
  paymentRef: string | null;
  checkedInAt?: string;
  refund?: number;
  createdAt: string;
}

export interface Member {
  firstName: string;
  lastName?: string;
  club: string;
  /** Club member number; empty when not set (then "charge to club account" isn't offered). */
  memberNo: string;
  vehicle: { label: string; plate: string; size: VehicleSize };
  plan: PlanId;
  planRenews: string;
  credits: Credits;
  defaultPayment: PaymentMethod;
  /** A saved card, or null when none has been added yet. */
  card: { brand: string; last4: string; exp: string } | null;
  notify: { started: boolean; ready: boolean; reminders: boolean };
}

/** Details collected when someone creates an account. */
export interface NewMemberDetails {
  firstName: string;
  lastName?: string;
  club?: string;
  memberNo?: string;
  vehicle?: { label: string; plate: string; size: VehicleSize };
}

export interface AppData {
  member: Member;
  bookings: Booking[];
}

export interface NewBooking {
  tier: TierId;
  size: VehicleSize;
  teeTime: string;
  stall: string;
  keys: KeyHandoff;
  addons: AddonId[];
  paymentMethod: PaymentMethod;
}
