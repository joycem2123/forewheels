import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import type { SymbolViewProps } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sym, T } from '@/components/ui';
import { useColors } from '@/theme';

const ICONS: Record<string, [string, SymbolViewProps['name'], string]> = {
  index: ['Home', 'house', '⌂'],
  bookings: ['Bookings', 'calendar', '▦'],
  passes: ['Passes', 'creditcard', '▭'],
  me: ['Me', 'person.crop.circle', '◉'],
};

/** Home, Bookings, a violet "+ Book" button in the middle, Passes, Me. */
function TabBar({ state, navigateToTab, insets: barInsets }: BottomTabBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, barInsets?.bottom ?? 0);
  const current = state.routes[state.index]?.name;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (route) navigateToTab(route.key);
  };
  const tab = (name: string) => {
    const [label, ios, glyph] = ICONS[name];
    const on = current === name;
    const color = on ? c.accent : c.muted;
    return (
      <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
        onPress={() => go(name)} style={{ alignItems: 'center', gap: 3, minWidth: 56, paddingVertical: 4 }}>
        <Sym ios={on ? (`${ios}.fill` as SymbolViewProps['name']) : ios} fallback={glyph} color={color} size={22} />
        <T size={10.5} weight="semibold" color={color}>{label}</T>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: bottom + 8, backgroundColor: c.card, borderTopColor: c.border, borderTopWidth: 1 }}>
      {tab('index')}
      {tab('bookings')}
      <Pressable accessibilityRole="button" accessibilityLabel="Book a detail" onPress={() => go('book')}
        style={({ pressed }) => ({ backgroundColor: c.accent, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, opacity: pressed ? 0.85 : 1, borderWidth: current === 'book' ? 3 : 0, borderColor: c.accentSoft })}>
        <T size={14} weight="bold" color={c.onAccent}>+ Book</T>
      </Pressable>
      {tab('passes')}
      {tab('me')}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="book" options={{ title: 'Book' }} />
      <Tabs.Screen name="passes" options={{ title: 'Passes' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
