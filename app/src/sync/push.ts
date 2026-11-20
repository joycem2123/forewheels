// Push notifications for booking updates (car checked in, ready, messages from staff, refunds, gifts).
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// While the app is open, updates show as the app's own banner instead (see listenToMine).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Ask for notification permission and save this phone's push token (signed-in members only). */
export async function registerForPush() {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user || user.is_anonymous || Platform.OS === 'web') return;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token) await supabase.from('push_tokens').upsert({ user_id: user.id, token, updated_at: new Date().toISOString() });
  } catch {
    // Notifications aren't available here; the in-app banner still works.
  }
}

/** Tapping a booking notification opens Bookings. */
export function watchNotificationTaps(open: (path: string) => void) {
  if (Platform.OS === 'web') return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const data = r.notification.request.content.data as Record<string, unknown> | undefined;
    if (data?.booking_id || data?.kind) open('/bookings');
  });
  return () => sub.remove();
}
