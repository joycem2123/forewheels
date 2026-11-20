// Connects accounts to the data kept on the phone: which data to load after signing in or out,
// and copying profile details into the member shown in the app.
import { newMember, type AppData, type VehicleSize } from '@forewheels/engine';

import { accountKey, GUEST_KEY, useStore } from '@/store/store';
import { loadProfile, saveProfile, signOut as authSignOut, type Profile } from './auth';
import { supabase } from './supabase';

/** Member details from a profile, laid over what the phone already has. */
export function applyProfile(d: AppData, p: Profile | null): AppData {
  if (!p) return d;
  const m = d.member;
  return {
    ...d,
    member: {
      ...m,
      firstName: p.first_name ?? m.firstName,
      lastName: p.last_name ?? m.lastName,
      club: p.club ?? m.club,
      memberNo: p.member_no ?? m.memberNo,
      vehicle: {
        label: p.vehicle_label ?? m.vehicle.label,
        plate: p.vehicle_plate ?? m.vehicle.plate,
        size: (p.vehicle_size as VehicleSize | null) ?? m.vehicle.size,
      },
      defaultPayment: m.defaultPayment === 'apple' && (p.member_no ?? m.memberNo) ? 'club' : m.defaultPayment,
    },
  };
}

/** After signing in: load only this account's data, then refresh it from the account's profile. */
export async function loadSignedInAccount(opts: { carryGuest?: boolean } = {}) {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  const st = useStore.getState();
  const key = accountKey(user.id, user.is_anonymous);
  // A brand-new account can start from this phone's guest data (bookings made while trying the app).
  const start = opts.carryGuest ? st.accounts[GUEST_KEY] ?? (st.accountKey === GUEST_KEY ? st.data : undefined) : undefined;
  st.switchAccount(key, start ?? newMember());
  const profile = await loadProfile().catch(() => null);
  const current = useStore.getState().data;
  const merged = applyProfile(current, profile);
  if (merged !== current) useStore.setState((s) => ({ data: merged, accounts: { ...s.accounts, [key]: merged } }));
}

/** Save the member's details to their account (name, club, vehicle). */
export async function pushProfile(username?: string) {
  const m = useStore.getState().data.member;
  await saveProfile({
    ...(username ? { username } : {}),
    first_name: m.firstName || null,
    last_name: m.lastName || null,
    club: m.club || null,
    member_no: m.memberNo || null,
    vehicle_label: m.vehicle.label || null,
    vehicle_plate: m.vehicle.plate || null,
    vehicle_size: m.vehicle.size,
  });
}

/** Sign out: back to the welcome screen, with the phone's guest data loaded. */
export async function signOutToWelcome() {
  await authSignOut().catch(() => undefined);
  const st = useStore.getState();
  st.switchAccount(GUEST_KEY);
  st.setOnboarded(false);
}
