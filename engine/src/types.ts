import type { AddonId, Credits, Gifts, PlanId, TierId, VehicleSize } from './catalog';

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
  /** Where a free wash came from (pass credit or staff gift). */
  creditSource?: 'plan' | 'gift' | null;
  paymentMethod: PaymentMethod | null;
  paymentRef: string | null;
  checkedInAt?: string;
  readyAt?: string;
  refund?: number;
  refundReason?: string;
  /** Set by staff while the car is being detailed: the current step and how far along (0–1). */
  stage?: string | null;
  progress?: number | null;
  /** Member's name and car, as staff see them. */
  memberName?: string | null;
  vehicleLabel?: string | null;
  /** Newest last: what staff did or said about this booking. */
  updates?: BookingUpdate[];
  createdAt: string;
}

export type UpdateKind = 'booked' | 'checked_in' | 'stage' | 'ready' | 'completed' | 'cancelled' | 'refund' | 'gift' | 'message';

export interface BookingUpdate {
  id: string;
  at: string;
  kind: UpdateKind;
  message: string;
  byStaff: boolean;
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
  /** Free washes gifted by staff. */
  gifts?: Gifts;
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
