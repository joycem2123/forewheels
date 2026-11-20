import { passwordOk } from '@forewheels/engine';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PasswordChecklist, PasswordField } from '@/components/form';
import { LogoMark } from '@/components/logo';
import { Button, T } from '@/components/ui';
import { loadSignedInAccount } from '@/sync/account-data';
import { setNewPassword } from '@/sync/auth';
import { supabase } from '@/sync/supabase';
import { useStore } from '@/store/store';
import { BRAND, useColors } from '@/theme';

/**
 * Opened from an email link (forewheels://auth-callback#access_token=…): signs you in, then goes Home.
 * A password-reset link asks for a new password first.
 */
export default function AuthCallback() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const url = Linking.useURL();
  const [state, setState] = useState<'working' | 'newPassword' | 'expired'>('working');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const full = url ?? (await Linking.getInitialURL()) ?? '';
      const hash = new URLSearchParams(full.split('#')[1] ?? '');
      const query = new URLSearchParams(full.split('?')[1]?.split('#')[0] ?? '');
      const access_token = hash.get('access_token');
      const refresh_token = hash.get('refresh_token');
      const recovery = hash.get('type') === 'recovery' || query.get('type') === 'recovery';
      if (access_token && refresh_token) {
        const { error: e } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!e) {
          await loadSignedInAccount();
          if (recovery) return setState('newPassword');
          useStore.getState().setOnboarded(true);
          return router.replace('/');
        }
      }
      setState('expired');
      setTimeout(() => router.replace('/welcome'), 2500);
    })();
  }, [url]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setNewPassword(pw);
      useStore.getState().setOnboarded(true);
      useStore.getState().notify('Password changed. You’re signed in.');
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (state === 'newPassword') {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND, paddingTop: insets.top + 40, paddingHorizontal: 22, gap: 18 }}>
        <View style={{ alignItems: 'center' }}><LogoMark size={72} onViolet /></View>
        <View style={{ backgroundColor: c.card, borderRadius: 28, padding: 20, gap: 14 }}>
          <T size={22} weight="bold">Choose a new password</T>
          <PasswordField label="New password" value={pw} onChangeText={setPw} newPassword />
          {pw.length > 0 && <PasswordChecklist password={pw} />}
          <PasswordField label="Retype new password" value={pw2} onChangeText={setPw2} newPassword />
          {pw2.length > 0 && pw2 !== pw && <T size={13} color={c.danger}>The passwords don’t match.</T>}
          {error && <T size={13} color={c.danger}>{error}</T>}
          <Button title={busy ? 'Saving…' : 'Save new password'} disabled={busy || !passwordOk(pw) || pw !== pw2} onPress={() => void save()} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: BRAND, padding: 24 }}>
      {state === 'working' && <ActivityIndicator color="#FFFFFF" />}
      <T size={16} color="#FFFFFF" style={{ textAlign: 'center' }}>
        {state === 'working' ? 'Signing you in…' : 'That link has expired. Sign in with your email and password, or ask for a new link.'}
      </T>
    </View>
  );
}
