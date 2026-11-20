import { emailOk, passwordOk } from '@forewheels/engine';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountNeeded } from '@/components/account-needed';
import { Field, PasswordChecklist, PasswordField } from '@/components/form';
import { Button, Row, T, shadow } from '@/components/ui';
import { signOutToWelcome } from '@/sync/account-data';
import { changeEmail, changePassword, deleteMyAccount, hasPassword, loadProfile, signInWithApple, useSession } from '@/sync/auth';
import { GUEST_KEY, useStore } from '@/store/store';
import { useColors } from '@/theme';

function Card({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: 24, padding: 16, gap: 12 }, shadow(c.shadow, 0.1, 12)]}>
      <T size={17} weight="bold">{title}</T>
      {children}
    </View>
  );
}

function Message({ text, error }: { text: string; error?: boolean }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: error ? c.dangerSoft : c.accentSoft, borderRadius: 14, padding: 12 }}>
      <T size={14} color={error ? c.danger : c.text}>{text}</T>
    </View>
  );
}

/** Account details: who I am, changing my email or password, signing out, and deleting the account. */
export default function Account() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const member = useStore((s) => s.data.member);
  const isGuest = useStore((s) => s.accountKey === GUEST_KEY);
  const user = session?.user;
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => { if (user && !user.is_anonymous) void loadProfile().then((p) => setUsername(p?.username ?? null)).catch(() => undefined); }, [user]);

  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<'email' | 'password' | 'delete' | 'signout' | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const scroll = (children: ReactNode) => (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {children}
    </ScrollView>
  );

  if (session === undefined) return null;
  if (!user || user.is_anonymous || isGuest) return scroll(<AccountNeeded what="manage your account" />);

  const withPassword = hasPassword(user);
  const sameEmail = newEmail.trim().toLowerCase() === (user.email ?? '').toLowerCase();
  const pending = user.new_email;

  const saveEmail = async () => {
    setBusy('email');
    setEmailMsg(null);
    try {
      await changeEmail(newEmail, emailPw);
      setEmailMsg({ text: `We’ve emailed a confirmation link to ${newEmail.trim()}. Tap it and your email changes. Until then, keep signing in with ${user.email}.` });
      setNewEmail('');
      setEmailPw('');
    } catch (e) {
      setEmailMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  const savePassword = async () => {
    setBusy('password');
    setPwMsg(null);
    try {
      await changePassword(current, next);
      setPwMsg({ text: 'Password changed. Use the new one next time you sign in.' });
      setCurrent('');
      setNext('');
      setAgain('');
    } catch (e) {
      setPwMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy('signout');
    await signOutToWelcome();
    router.replace('/welcome');
  };

  // Deleting needs the current password (checked by the server). Apple-only accounts confirm with Apple again.
  const reallyDelete = async () => {
    setBusy('delete');
    setDeleteError(null);
    try {
      let appleCode: string | null = null;
      if (!withPassword) {
        const ok = await signInWithApple().catch(() => null);
        if (!ok) return setBusy(null);
        appleCode = ok.authorizationCode;
      }
      const res = await deleteMyAccount(deletePw, appleCode);
      const st = useStore.getState();
      // Forget this account's data on the phone too.
      const { [st.accountKey]: _gone, ...rest } = st.accounts;
      useStore.setState({ accounts: rest });
      await signOutToWelcome();
      router.replace('/welcome');
      if (!withPassword && res.appleRevoked === false) {
        Alert.alert('Account deleted', 'To finish removing Fore Wheels from your Apple ID, go to Settings → your name → Sign-In & Security → Sign in with Apple → Fore Wheels → Stop Using Apple ID.');
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return scroll(
    <>
      <Card title="Your account">
        {[
          ['Name', `${member.firstName} ${member.lastName ?? ''}`.trim() || '–'],
          ['Username', username ? `@${username}` : '–'],
          ['Email', user.email || '–'],
          ['Signs in with', withPassword ? 'Email and password' : 'Apple'],
        ].map(([k, v]) => (
          <Row key={k} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
            <T muted>{k}</T>
            <T weight="semibold" style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
          </Row>
        ))}
      </Card>

      {withPassword ? (
        <>
          <Card title="Change email">
            {pending ? <Message text={`Waiting to confirm ${pending}. Tap the link we sent to it.`} /> : null}
            <Field label="New email" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
            <PasswordField label="Current password" value={emailPw} onChangeText={setEmailPw} />
            {newEmail && !emailOk(newEmail) ? <T size={13} color={c.danger}>That doesn’t look like an email address.</T> : null}
            {sameEmail ? <T size={13} color={c.danger}>That’s already your email.</T> : null}
            {emailMsg && <Message {...emailMsg} />}
            <Button title={busy === 'email' ? 'Saving…' : 'Change email'} disabled={!emailOk(newEmail) || sameEmail || !emailPw || busy !== null} onPress={() => void saveEmail()} />
          </Card>

          <Card title="Change password">
            <PasswordField label="Current password" value={current} onChangeText={setCurrent} />
            <PasswordField label="New password" value={next} onChangeText={setNext} newPassword />
            {next.length > 0 && <PasswordChecklist password={next} />}
            <PasswordField label="Retype new password" value={again} onChangeText={setAgain} newPassword />
            {again && next !== again ? <T size={13} color={c.danger}>The new passwords don’t match.</T> : null}
            {pwMsg && <Message {...pwMsg} />}
            <Button title={busy === 'password' ? 'Saving…' : 'Change password'} disabled={!current || !passwordOk(next) || next !== again || busy !== null} onPress={() => void savePassword()} />
          </Card>
        </>
      ) : (
        <Card title="Sign-in">
          <T muted>You sign in with Apple, so there’s no password to manage here.</T>
        </Card>
      )}

      <Button title={busy === 'signout' ? 'Signing out…' : 'Sign out'} kind="ghost" disabled={busy !== null} onPress={() => void signOut()} />

      <Card title="Delete account">
        <T size={14} muted>Permanently deletes your Fore Wheels account and your details. Bookings already paid for are kept for our records. This can’t be undone.</T>
        {!askDelete ? (
          <Button title="Delete my account" kind="danger" disabled={busy !== null} onPress={() => { setDeletePw(''); setDeleteError(null); setAskDelete(true); }} />
        ) : (
          <View style={{ backgroundColor: c.dangerSoft, borderRadius: 16, padding: 12, gap: 10 }}>
            <T weight="bold">Delete your account for good?</T>
            {withPassword
              ? <PasswordField label="Current password" value={deletePw} onChangeText={(t) => { setDeletePw(t); setDeleteError(null); }} />
              : <T size={13} muted>You’ll confirm with Apple to finish.</T>}
            {deleteError ? <T size={13} color={c.danger}>{deleteError}</T> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Keep it" kind="ghost" small style={{ flex: 1 }} onPress={() => setAskDelete(false)} />
              <Button title={busy === 'delete' ? 'Deleting…' : 'Delete forever'} kind="dangerFill" small style={{ flex: 1 }} disabled={(withPassword && !deletePw) || busy === 'delete'} onPress={() => void reallyDelete()} />
            </View>
          </View>
        )}
      </Card>
    </>,
  );
}
