import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from '@expo-google-fonts/instrument-sans';
import { DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Toast } from '@/components/ui';
import { watchNotificationTaps } from '@/sync/push';
import { SyncProvider } from '@/sync/sync-provider';
import { fonts, useColors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const c = useColors();
  const [loaded, error] = useFonts({ InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold });
  const ready = loaded || !!error;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  useEffect(() => watchNotificationTaps((path) => router.navigate(path as '/bookings')), []);
  if (!ready) return null;

  const base = DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.bg, card: c.card, primary: c.accent, text: c.text, border: c.border } }}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.accent,
            headerTitleStyle: { color: c.text, fontFamily: fonts.bold },
            contentStyle: { backgroundColor: c.bg },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          <Stack.Screen name="account" options={{ title: 'Account settings', headerBackTitle: 'Me' }} />
          <Stack.Screen name="staff/index" options={{ title: 'Today’s bay', headerBackTitle: 'Me' }} />
          <Stack.Screen name="staff/[id]" options={{ title: 'Booking', headerBackTitle: 'Bay' }} />
          <Stack.Screen
            name="checkout"
            options={{ title: 'Review & pay', presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true, sheetCornerRadius: 30, headerShown: false }}
          />
        </Stack>
        <SyncProvider />
        <Toast />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
