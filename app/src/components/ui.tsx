import type { TierId } from '@forewheels/engine';
import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/store/store';
import { BRAND, fonts, radius, space, useColors } from '@/theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

/** All text in the app goes through this, so Instrument Sans is used everywhere. */
export function T({ children, size = 15, weight = 'regular', muted, color, style, numberOfLines }: {
  children: ReactNode; size?: number; weight?: Weight; muted?: boolean; color?: string;
  style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts[weight], fontSize: size, color: color ?? (muted ? c.muted : c.text), lineHeight: Math.round(size * 1.3) }, style]}>
      {children}
    </Text>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <T size={28} weight="bold" style={{ letterSpacing: -0.4 }}>{children}</T>;
}

export function Section({ children }: { children: ReactNode }) {
  return <T size={13} weight="bold" muted style={{ marginBottom: -6 }}>{children}</T>;
}

/** A tab screen: scrolls, clears the status bar and leaves room for the tab bar. */
export function Screen({ children, bottom = 110 }: { children: ReactNode; bottom?: number }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + bottom, paddingHorizontal: space.xl, gap: space.lg }}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, style]}>{children}</View>;
}

export function Pill({ label, kind = 'soft' }: { label: string; kind?: 'soft' | 'ink' | 'ghost' | 'ok' | 'white' }) {
  const c = useColors();
  const s = {
    soft: { bg: c.accentSoft, fg: c.accentInk, bd: 'transparent' },
    ink: { bg: c.text, fg: c.bg, bd: 'transparent' },
    ghost: { bg: 'transparent', fg: c.muted, bd: c.border },
    ok: { bg: 'transparent', fg: c.ok, bd: c.ok },
    white: { bg: '#FFFFFF', fg: '#5638E0', bd: 'transparent' },
  }[kind];
  return (
    <View style={{ backgroundColor: s.bg, borderColor: s.bd, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
      <T size={11.5} weight="bold" color={s.fg}>{label}</T>
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled, small, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'dangerFill' | 'white' | 'dark';
  disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const s = {
    primary: { bg: c.accent, fg: c.onAccent, bd: c.accent },
    ghost: { bg: c.card, fg: c.text, bd: c.border },
    danger: { bg: c.card, fg: c.danger, bd: c.danger },
    dangerFill: { bg: c.danger, fg: '#FFFFFF', bd: c.danger },
    white: { bg: '#FFFFFF', fg: '#5638E0', bd: '#FFFFFF' },
    dark: { bg: '#FFFFFF', fg: '#1F1A3A', bd: '#FFFFFF' },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: s.bg, borderColor: s.bd, borderWidth: 1, borderRadius: small ? 12 : 18, paddingVertical: small ? 9 : 15, paddingHorizontal: small ? 14 : 18, alignItems: 'center', opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      <T size={small ? 13 : 16} weight="bold" color={s.fg}>{title}</T>
    </Pressable>
  );
}

/** Two or three choices side by side (car or SUV, upcoming or past). */
export function Segmented<V extends string>({ value, options, onChange, label }: {
  value: V; options: [V, string][]; onChange: (v: V) => void; label: string;
}) {
  const c = useColors();
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: c.segment, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 4 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(v)}
            style={[{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' }, on && { backgroundColor: c.card, ...shadow(c.shadow, 0.12, 3) }]}>
            <T size={13} weight="semibold" muted={!on}>{l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Progress as a row of soap bubbles. */
export function Bubbles({ pct, count = 8, small }: { pct: number; count?: number; small?: boolean }) {
  const c = useColors();
  const filled = Math.floor(pct * count);
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View accessible accessibilityLabel={`${Math.round(pct * 100)}% done`} style={{ flexDirection: 'row', alignItems: 'center', gap: small ? 4 : 6 }}>
      {Array.from({ length: count }, (_, i) => {
        const size = small ? 10 : i % 2 ? 24 : 28;
        const on = i < filled;
        const cur = i === filled && pct < 1;
        const bg = small ? (on || cur ? c.accent : c.bubble) : on || cur ? '#FFFFFF' : 'rgba(255,255,255,0.22)';
        return (
          <View key={i} style={{ width: size, height: size }}>
            {cur && !small && (
              <Animated.View style={{ position: 'absolute', left: -5, top: -5, right: -5, bottom: -5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.3)', transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }] }} />
            )}
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }} />
          </View>
        );
      })}
    </View>
  );
}

/** Credits left, shown as a number in a ring with small dots for each credit. */
export function CreditBadge({ left, of }: { left: number; of: number }) {
  const c = useColors();
  return (
    <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 7, borderColor: left > 0 ? c.accent : c.border, alignItems: 'center', justifyContent: 'center' }}>
      <T size={20} weight="bold">{left}</T>
      <T size={9} weight="semibold" muted style={{ marginTop: -3 }}>of {of}</T>
    </View>
  );
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export function DateTile({ date, accent, label }: { date: Date; accent?: boolean; label?: string }) {
  const c = useColors();
  return (
    <View style={{ width: 52, height: 56, borderRadius: 14, backgroundColor: accent ? BRAND : c.dark, alignItems: 'center', justifyContent: 'center' }}>
      <T size={10} weight="bold" color={accent ? '#E2DBFF' : c.darkMuted} style={{ letterSpacing: 0.6 }}>{label ?? DAYS[date.getDay()]}</T>
      <T size={20} weight="bold" color="#FFFFFF" style={{ lineHeight: 22 }}>{date.getDate()}</T>
    </View>
  );
}

/** iOS SF Symbol with a text fallback elsewhere. */
export function Sym({ ios, fallback, color, size = 24 }: { ios: SymbolViewProps['name']; fallback: string; color: string; size?: number }) {
  if (Platform.OS === 'ios') return <SymbolView name={ios} tintColor={color} size={size} />;
  return <T size={size * 0.85} color={color}>{fallback}</T>;
}

/** One sparkle for Express, two for Signature, three for Pro. */
export function TierMark({ tier }: { tier: TierId }) {
  const c = useColors();
  const sym: Record<TierId, [SymbolViewProps['name'], string]> = {
    express: ['sparkle', '✦'],
    signature: ['sparkles', '✦✦'],
    pro: ['wand.and.stars', '✦✦✦'],
  };
  return (
    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Sym ios={sym[tier][0]} fallback={sym[tier][1]} color={c.accent} size={tier === 'express' ? 22 : 24} />
    </View>
  );
}

const MARK_VIOLET = require('../../assets/images/mark-violet.png');

/** Small logo for screen headers: the Ball-wheel mark and the name. */
export function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel="Fore Wheels">
      <Image source={MARK_VIOLET} style={{ width: 28, height: 28 }} contentFit="contain" />
      <T size={17} weight="bold">Fore Wheels</T>
    </View>
  );
}

/** Decorative bubbles in the corner of the violet cards. */
export function CornerBubbles({ big = 120 }: { big?: number }) {
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', width: big, height: big, borderRadius: big / 2, right: -30, top: -30, backgroundColor: 'rgba(255,255,255,0.14)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 60, height: 60, borderRadius: 30, right: 70, top: 60, backgroundColor: 'rgba(255,255,255,0.10)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 30, height: 30, borderRadius: 15, right: 30, top: 110, backgroundColor: 'rgba(255,255,255,0.18)' }} />
    </>
  );
}

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const c = useColors();
  const base = [{ backgroundColor: c.card, borderRadius: 24, padding: space.lg, ...shadow(c.shadow, 0.12, 14) }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 92, backgroundColor: c.text, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}>
      <T size={14} weight="semibold" color={c.bg}>{toast}</T>
    </View>
  );
}

export function shadow(color: string, opacity: number, blur: number): ViewStyle {
  return { shadowColor: color, shadowOpacity: opacity, shadowRadius: blur, shadowOffset: { width: 0, height: blur / 2 }, elevation: Math.round(blur / 4) };
}

export const styles = StyleSheet.create({
  fill: { flex: 1 },
});
