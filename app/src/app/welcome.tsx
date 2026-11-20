import { emailOk, looksLikeEmail, newMember, passwordOk, type VehicleSize } from '@forewheels/engine';
import { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, PasswordChecklist, PasswordField, UsernameField, type UsernameStatus } from '@/components/form';
import { LogoMark, Wordmark } from '@/components/logo';
import { Button, CornerBubbles, Segmented, T } from '@/components/ui';
import { appleSignInAvailable, ensureSession, releaseUsername, sendPasswordReset, signIn, signInWithApple, signUp } from '@/sync/auth';
import { loadSignedInAccount, pushProfile } from '@/sync/account-data';
import { accountKey, useStore } from '@/store/store';
import { BRAND, BRAND_INK, fonts, useColors } from '@/theme';

/** Text boxes drawn on the violet background. */
const ON_VIOLET_INPUT = {
  backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 16,
  color: '#FFFFFF', fontSize: 16, fontFamily: fonts.medium, paddingHorizontal: 16, paddingVertical: 15,
} as const;

type Mode = 'choose' | 'signUp' | 'profile' | 'forgotPw';

/** The first screen: sign in, create an account, or look around as a guest. Same flow as Clutch Up's welcome. */
export default function Welcome() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const setOnboarded = useStore((s) => s.setOnboarded);
  const updateMember = useStore((s) => s.updateMember);
  const [mode, setMode] = useState<Mode>('choose');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Sign-in
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  // New account
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [uStatus, setUStatus] = useState<UsernameStatus>('empty');
  const [email, setEmail] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [size, setSize] = useState<VehicleSize>('car');
  const [memberNo, setMemberNo] = useState('');
  const onUStatus = useCallback((s: UsernameStatus) => setUStatus(s), []);

  // Sign in with Apple: shown only where it works (iPhone, on a build that has it).
  const [appleOk, setAppleOk] = useState(false);
  useEffect(() => { void appleSignInAvailable().then(setAppleOk); }, []);

  const go = (m: Mode) => { setMode(m); setMessage(null); };
  const done = () => {
    setOnboarded(true);
    router.replace('/');
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  /** The details typed on the form, saved into the member shown in the app. */
  const saveDetails = () =>
    updateMember({
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      memberNo: memberNo.trim(),
      vehicle: { label: vehicle.trim(), plate: '', size },
      ...(memberNo.trim() ? { defaultPayment: 'club' as const } : {}),
    });

  const doSignIn = () =>
    run(async () => {
      await signIn(login, password);
      await loadSignedInAccount();
      done();
    });

  const doApple = () =>
    run(async () => {
      const res = await signInWithApple();
      if (!res) return; // cancelled
      await loadSignedInAccount({ carryGuest: res.needsProfile });
      if (!res.needsProfile) return done();
      setFirstName(res.firstName);
      setLastName(res.lastName);
      go('profile');
    });

  const doSignUp = () =>
    run(async () => {
      // A guest moving to a full account hands their username over to it.
      await releaseUsername().catch(() => undefined);
      const profile = {
        username, first_name: firstName.trim(), last_name: lastName.trim(),
        member_no: memberNo.trim() || null, vehicle_label: vehicle.trim() || null, vehicle_size: size,
      };
      const { needsConfirmation, userId } = await signUp(email, newPw, profile);
      // A new account starts from this phone's guest data (anything booked while looking around).
      useStore.getState().switchAccount(accountKey(userId), useStore.getState().data ?? newMember());
      saveDetails();
      if (!needsConfirmation) return done();
      setLogin(email.trim());
      setPassword('');
      setMode('choose');
      setMessage({ text: `We sent a confirmation link to ${email.trim()}. Tap it, then come back and sign in.` });
    });

  const doProfile = () =>
    run(async () => {
      saveDetails();
      await pushProfile(username);
      done();
    });

  const doGuest = () =>
    run(async () => {
      // Guests get a temporary online session. With no signal, carry on offline.
      await ensureSession().catch(() => null);
      done();
    });

  const detailsOk = !!firstName.trim() && !!lastName.trim() && uStatus === 'available';
  const signUpOk = detailsOk && emailOk(email) && passwordOk(newPw) && newPw === newPw2;
  const signInOk = login.trim().replace(/^@/, '').length >= 3 && !!password;

  const details = (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field flex label="First name" value={firstName} onChangeText={setFirstName} placeholder="Alex" autoCapitalize="words" autoComplete="given-name" textContentType="givenName" />
        <Field flex label="Last name" value={lastName} onChangeText={setLastName} placeholder="Smith" autoCapitalize="words" autoComplete="family-name" textContentType="familyName" />
      </View>
      <UsernameField value={username} onChange={setUsername} onStatus={onUStatus} />
      <Field label="Your car (optional)" value={vehicle} onChangeText={setVehicle} placeholder="e.g. 2023 Audi Q5" autoCapitalize="words" />
      <Segmented label="Vehicle size" value={size} onChange={setSize} options={[['car', 'Car'], ['suv', 'SUV / Truck']]} />
      <Field label="Club member number (optional)" value={memberNo} onChangeText={setMemberNo} placeholder="e.g. 4471 (to charge your club account)" keyboardType="number-pad" />
    </>
  );

  const msg = message ? <T size={14} color={message.error ? c.danger : c.ok}>{message.text}</T> : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BRAND }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CornerBubbles big={220} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24, paddingHorizontal: 22, gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <LogoMark size={mode === 'choose' ? 112 : 72} onViolet />
          <Wordmark size={mode === 'choose' ? 34 : 26} color="#FFFFFF" center />
          {mode === 'choose' && (
            <T size={12} weight="bold" color="rgba(255,255,255,0.8)" style={{ letterSpacing: 1.8, textAlign: 'center' }}>PLAY YOUR ROUND. DRIVE HOME CLEAN.</T>
          )}
        </View>

        {mode === 'choose' && (
          <View style={{ gap: 12, marginTop: 'auto' }}>
            {appleOk && (
              <>
                <AppleAuthenticationButton
                  buttonType={AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={16}
                  style={{ height: 52, width: '100%' }}
                  onPress={() => void doApple()}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                  <T size={14} color="rgba(255,255,255,0.75)">or sign in with email</T>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                </View>
              </>
            )}
            <TextInput
              value={login}
              onChangeText={setLogin}
              placeholder="Username or email"
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              keyboardType={looksLikeEmail(login) ? 'email-address' : 'default'}
              accessibilityLabel="Username or email"
              style={ON_VIOLET_INPUT}
            />
            <View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.6)"
                secureTextEntry={!showPw}
                autoComplete="current-password"
                textContentType="password"
                accessibilityLabel="Password"
                onSubmitEditing={() => { if (signInOk) void doSignIn(); }}
                style={[ON_VIOLET_INPUT, { paddingRight: 64 }]}
              />
              <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
                <T size={13} weight="bold" color="rgba(255,255,255,0.8)">{showPw ? 'Hide' : 'Show'}</T>
              </Pressable>
            </View>
            <Pressable hitSlop={8} onPress={() => { go('forgotPw'); if (!looksLikeEmail(login)) setEmail(''); else setEmail(login.trim()); }} style={{ alignSelf: 'flex-start' }} accessibilityRole="button">
              <T weight="bold" color="#FFFFFF">Forgot password?</T>
            </Pressable>
            {message && <T size={14} color={message.error ? '#FFD3CE' : '#FFFFFF'}>{message.text}</T>}
            <Pressable onPress={() => void doSignIn()} disabled={busy || !signInOk} accessibilityRole="button"
              style={({ pressed }) => ({ backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 15, alignItems: 'center', opacity: busy || !signInOk ? 0.6 : pressed ? 0.85 : 1 })}>
              <T size={17} weight="bold" color={BRAND_INK}>{busy ? 'Signing in…' : 'Sign in'}</T>
            </Pressable>
            <Pressable onPress={() => go('signUp')} hitSlop={6} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 4, flexDirection: 'row' }}>
              <T size={15} color="#FFFFFF">New to Fore Wheels? </T>
              <T size={15} weight="bold" color="#FFFFFF" style={{ textDecorationLine: 'underline' }}>Create a free account</T>
            </Pressable>
            <Pressable onPress={() => void doGuest()} disabled={busy} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 6 }}>
              <T size={14} weight="semibold" color="rgba(255,255,255,0.75)">Continue as guest (look around)</T>
            </Pressable>
          </View>
        )}

        {mode === 'signUp' && (
          <Sheet title="Create your account" sub="Book details, manage your pass and see your car’s progress on any phone.">
            {details}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
            <PasswordField label="Password" value={newPw} onChangeText={setNewPw} newPassword />
            {newPw.length > 0 && <PasswordChecklist password={newPw} />}
            <PasswordField label="Retype password" value={newPw2} onChangeText={setNewPw2} newPassword />
            {newPw2.length > 0 && newPw2 !== newPw && <T size={13} color={c.danger}>The passwords don’t match.</T>}
            {msg}
            <Button title={busy ? 'Please wait…' : 'Create account'} disabled={busy || !signUpOk} onPress={() => void doSignUp()} />
            <Pressable hitSlop={8} onPress={() => go('choose')} style={{ alignSelf: 'center' }} accessibilityRole="button">
              <T weight="bold" color={c.accent}>Already have an account? Sign in</T>
            </Pressable>
          </Sheet>
        )}

        {mode === 'profile' && (
          // A new account from Sign in with Apple: the rest of the details (Apple shares the name the first time).
          <Sheet title="Finish setting up" sub="Your username lets you sign in without Apple too, and lets the pro shop find your booking.">
            {details}
            {msg}
            <Button title={busy ? 'Saving…' : 'Start booking'} disabled={busy || !detailsOk} onPress={() => void doProfile()} />
          </Sheet>
        )}

        {mode === 'forgotPw' && (
          <Sheet title="Reset your password" sub="Enter the email on your account. We’ll email you a link to choose a new password.">
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
            {msg}
            <Button
              title={busy ? 'Please wait…' : 'Send reset link'}
              disabled={busy || !emailOk(email)}
              onPress={() =>
                void run(async () => {
                  await sendPasswordReset(email);
                  setMessage({ text: `If ${email.trim()} has a Fore Wheels account, a reset link is on its way. Open it on this phone to choose a new password. Check your junk folder if you don’t see it.` });
                })
              }
            />
            <Button title="Back to sign in" kind="ghost" onPress={() => go('choose')} />
          </Sheet>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** White card for the longer forms, sitting on the violet background. */
function Sheet({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 28, padding: 20, gap: 14, marginTop: 'auto' }}>
      <View style={{ gap: 4 }}>
        <T size={22} weight="bold">{title}</T>
        {sub ? <T size={14} muted>{sub}</T> : null}
      </View>
      {children}
    </View>
  );
}
