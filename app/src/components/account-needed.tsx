import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, T } from '@/components/ui';
import { useStore } from '@/store/store';
import { useColors } from '@/theme';

/** Shown to guests where an account is needed (booking, passes). */
export function AccountNeeded({ what }: { what: string }) {
  const c = useColors();
  const setOnboarded = useStore((s) => s.setOnboarded);
  return (
    <View style={{ backgroundColor: c.accentSoft, borderRadius: 20, padding: 16, gap: 10 }}>
      <T size={16} weight="bold">Create a free account to {what}</T>
      <T size={13.5} muted>You’re looking around as a guest. An account keeps your bookings and pass, and lets us text you when your car is ready.</T>
      <Button title="Create account or sign in" onPress={() => { setOnboarded(false); router.replace('/welcome'); }} />
    </View>
  );
}
