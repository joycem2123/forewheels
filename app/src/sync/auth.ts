// Accounts: sign up, sign in (email or username), Sign in with Apple, guests, password and email changes.
// Same behaviour as Clutch Up's accounts, on Fore Wheels' own Supabase project.
import { looksLikeEmail, USERNAME_RULE, type VehicleSize } from '@forewheels/engine';
import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { AUTH_REDIRECT, supabase } from './supabase';

const offline = (m: string) => /fetch|network/i.test(m);
const NO_CONNECTION = 'No connection. Try again when you have signal.';

/** What's stored about a member online (their bookings stay on the phone for now). */
export interface Profile {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  club: string | null;
  member_no: string | null;
  vehicle_label: string | null;
  vehicle_plate: string | null;
  vehicle_size: VehicleSize | null;
}

const PROFILE_COLUMNS = 'id, username, first_name, last_name, club, member_no, vehicle_label, vehicle_plate, vehicle_size';

/** Guests get an anonymous session (no email needed), so they can look around. */
export async function ensureSession(): Promise<Session> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.session) throw new Error(error && offline(error.message) ? NO_CONNECTION : 'Could not start a guest session. Try again.');
  return anon.session;
}

export async function usernameAvailable(u: string): Promise<boolean> {
  if (!USERNAME_RULE.test(u)) return false;
  const { data, error } = await supabase.rpc('username_available', { u });
  if (error) throw new Error('Could not check the username. Check your connection.');
  return !!data;
}

/** Save my details to my account. A taken username comes back as a clear message. */
export async function saveProfile(p: Omit<Partial<Profile>, 'id'>): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error('Sign in first.');
  const { error } = await supabase.from('profiles').upsert({ id: user.id, ...p });
  if (error) {
    if (error.code === '23505') throw new Error(`@${p.username} is already taken. Try another.`);
    throw new Error(offline(error.message) ? NO_CONNECTION : error.message);
  }
}

export async function loadProfile(): Promise<Profile | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle();
  return (profile as Profile | null) ?? null;
}

/** Free my username (used when a guest moves to a full account). */
export async function releaseUsername() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user?.is_anonymous) await supabase.from('profiles').update({ username: null }).eq('id', user.id);
}

export async function signUp(email: string, password: string, profile: Omit<Partial<Profile>, 'id'>) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() }, emailRedirectTo: AUTH_REDIRECT },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (data.session) await saveProfile(profile);
  return { needsConfirmation: !data.session, userId: data.user?.id ?? null };
}

/** Sign in with an email or a username. A username is swapped for its email only if the password is right. */
export async function signIn(emailOrUsername: string, password: string) {
  let email = emailOrUsername.trim();
  if (!looksLikeEmail(email)) {
    const { data, error } = await supabase.rpc('login_email', { u: email, pw: password });
    if (error) {
      throw new Error(
        /too_many_attempts/.test(error.message)
          ? 'Too many wrong tries for that username. Wait 15 minutes, or sign in with your email.'
          : offline(error.message)
            ? NO_CONNECTION
            : 'Could not sign in. Try again.',
      );
    }
    if (!data) throw new Error('Email/username and password don’t match.');
    email = data as string;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      /invalid login|invalid credentials/i.test(error.message)
        ? 'Email/username and password don’t match.'
        : /not confirmed/i.test(error.message)
          ? 'Confirm your email first: tap the link we sent you.'
          : offline(error.message)
            ? NO_CONNECTION
            : error.message,
    );
  }
}

/** Email a reset link. It opens the app, which then asks for a new password. */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${AUTH_REDIRECT}?type=recovery` });
  if (error && offline(error.message)) throw new Error(NO_CONNECTION);
  if (error && /rate|too many|seconds/i.test(error.message)) throw new Error('Too many tries. Wait a minute, then try again.');
  // Any other error is ignored on purpose: we never reveal whether an email has an account.
}

/** Set a new password after opening a reset link (no current password needed then). */
export async function setNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export const friendlyAuthError = (m: string) =>
  /invalid login|invalid credentials/i.test(m)
    ? 'Your current password isn’t right.'
    : /same.*password|different from the old/i.test(m)
      ? 'Choose a password different from your current one.'
      : /already (been )?registered|already in use|email.*exists/i.test(m)
        ? 'That email already has an account. Sign in instead.'
        : /weak|at least|short|should contain|characters/i.test(m)
          ? 'That password is too weak. Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.'
          : offline(m)
            ? NO_CONNECTION
            : m;

/** Check the current password before a sensitive change. */
async function confirmPassword(current: string) {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email) throw new Error('Sign in first.');
  const { error } = await supabase.auth.signInWithPassword({ email, password: current });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** Change my email. The change applies once the link sent to the new address is tapped. */
export async function changeEmail(newEmail: string, currentPassword: string) {
  await confirmPassword(currentPassword);
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() }, { emailRedirectTo: AUTH_REDIRECT });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await confirmPassword(currentPassword);
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/**
 * Sign in with Apple (iPhone only; the button only shows where it's available). Returns the account, whether it
 * still needs a username (a brand-new account), and the name Apple shared (only given the very first time).
 * null = cancelled.
 */
export async function signInWithApple(): Promise<{ userId: string; needsProfile: boolean; firstName: string; lastName: string; authorizationCode: string | null } | null> {
  const Apple = await import('expo-apple-authentication');
  let cred;
  try {
    cred = await Apple.signInAsync({ requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL] });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw new Error('Sign in with Apple didn’t work. Try again.');
  }
  if (!cred.identityToken) throw new Error('Sign in with Apple didn’t work. Try again.');
  const firstName = cred.fullName?.givenName?.trim() ?? '';
  const lastName = cred.fullName?.familyName?.trim() ?? '';
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
  if (error || !data.user) throw new Error(error && offline(error.message) ? NO_CONNECTION : 'Sign in with Apple didn’t work. Try again.');
  const userId = data.user.id;
  if (firstName || lastName) await supabase.from('profiles').upsert({ id: userId, first_name: firstName || null, last_name: lastName || null });
  const profile = await loadProfile();
  return {
    userId,
    needsProfile: !profile?.username,
    firstName: firstName || profile?.first_name || '',
    lastName: lastName || profile?.last_name || '',
    // One-time code from Apple (used when deleting an account, to disconnect it from the Apple ID).
    authorizationCode: cred.authorizationCode ?? null,
  };
}

/** Is Sign in with Apple available on this phone (and in this build of the app)? */
export async function appleSignInAvailable(): Promise<boolean> {
  try {
    const Apple = await import('expo-apple-authentication');
    return await Apple.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Does this account sign in with a password (email), as opposed to only Sign in with Apple? */
export function hasPassword(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  const providers = (user?.app_metadata?.providers as string[] | undefined) ?? (user?.app_metadata?.provider ? [user.app_metadata.provider as string] : []);
  return providers.length === 0 || providers.includes('email');
}

/** Permanently delete my account (checked on the server: password, or a fresh Apple confirmation). */
export async function deleteMyAccount(password: string, appleCode: string | null): Promise<{ appleRevoked?: boolean; appleDetail?: string }> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { password, appleCode } });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? (offline(error.message) ? NO_CONNECTION : 'Could not delete the account. Try again.'));
  }
  await supabase.auth.signOut().catch(() => undefined);
  return data ?? {};
}
