import { cleanUsername, PASSWORD_RULES, USERNAME_RULE } from '@forewheels/engine';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { T } from '@/components/ui';
import { usernameAvailable } from '@/sync/auth';
import { fonts, useColors } from '@/theme';

/** A labelled text box. */
export function Field({ label, flex, ...props }: TextInputProps & { label: string; flex?: boolean }) {
  const c = useColors();
  return (
    <View style={{ gap: 6, flex: flex ? 1 : undefined }}>
      <T size={13} weight="bold" muted>{label}</T>
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label}
        {...props}
        style={[{ backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 16, color: c.text }, props.style]}
      />
    </View>
  );
}

/** A password box with Show / Hide. */
export function PasswordField({ label, value, onChangeText, newPassword, onFocus, onSubmitEditing }: {
  label: string; value: string; onChangeText: (v: string) => void; newPassword?: boolean; onFocus?: () => void; onSubmitEditing?: () => void;
}) {
  const c = useColors();
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T size={13} weight="bold" muted>{label}</T>
      <View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmitEditing}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          textContentType={newPassword ? 'newPassword' : 'password'}
          placeholder={newPassword ? 'Create a strong password' : undefined}
          placeholderTextColor={c.muted}
          accessibilityLabel={label}
          style={{ backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: 14, paddingLeft: 14, paddingRight: 64, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 16, color: c.text }}
        />
        <Pressable onPress={() => setShow((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
          <T size={13} weight="bold" color={c.accent}>{show ? 'Hide' : 'Show'}</T>
        </Pressable>
      </View>
    </View>
  );
}

/** Live checklist under a new-password box: each rule ticks as it's met. */
export function PasswordChecklist({ password }: { password: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 2, marginTop: -4 }}>
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <T key={r.id} size={13} color={ok ? c.ok : c.muted} style={{ lineHeight: 18 }}>
            {ok ? '✓' : '○'}  {r.label}
          </T>
        );
      })}
    </View>
  );
}

export type UsernameStatus = 'empty' | 'invalid' | 'checking' | 'available' | 'taken' | 'offline';

/** @username box that checks availability as you type. */
export function UsernameField({ value, onChange, onStatus, current, onFocus }: {
  value: string; onChange: (v: string) => void; onStatus: (s: UsernameStatus) => void; current?: string | null; onFocus?: () => void;
}) {
  const c = useColors();
  const [status, setStatus] = useState<UsernameStatus>('empty');

  useEffect(() => {
    let cancelled = false;
    const report = (s: UsernameStatus) => {
      if (cancelled) return;
      setStatus(s);
      onStatus(s);
    };
    if (!value) return report('empty');
    if (!USERNAME_RULE.test(value)) return report('invalid');
    if (current && value === current) return report('available');
    report('checking');
    const t = setTimeout(() => {
      usernameAvailable(value).then((ok) => report(ok ? 'available' : 'taken')).catch(() => report('offline'));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, current, onStatus]);

  const msg: Record<UsernameStatus, { text: string; color: string }> = {
    empty: { text: '3–20 characters: letters, numbers, _ or .', color: c.muted },
    invalid: { text: 'Use 3–20 lowercase letters, numbers, _ or .', color: c.danger },
    checking: { text: 'Checking…', color: c.muted },
    available: { text: `@${value} is available`, color: c.ok },
    taken: { text: `@${value} is taken. Try another.`, color: c.danger },
    offline: { text: 'Can’t check right now (no connection).', color: c.danger },
  };
  const border = status === 'available' ? c.ok : status === 'taken' || status === 'invalid' ? c.danger : c.border;

  return (
    <View style={{ gap: 6 }}>
      <T size={13} weight="bold" muted>Username</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, borderRadius: 14, borderWidth: 1, borderColor: border }}>
        <T size={16} muted style={{ paddingLeft: 14 }}>@</T>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(cleanUsername(v))}
          onFocus={onFocus}
          placeholder="alexsmith"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Username"
          style={{ flex: 1, color: c.text, fontSize: 16, fontFamily: fonts.medium, paddingVertical: 12, paddingHorizontal: 4 }}
        />
      </View>
      <T size={12} color={msg[status].color}>{msg[status].text}</T>
    </View>
  );
}
