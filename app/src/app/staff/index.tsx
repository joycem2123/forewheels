import { clock, STAGES, TIERS, type Booking } from '@forewheels/engine';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Pill, Row, Segmented, T, shadow } from '@/components/ui';
import { bookingsForDay, listenToBay, staffAct, useIsStaff, type StaffAction } from '@/sync/staff';
import { useStore } from '@/store/store';
import { useColors } from '@/theme';

type Filter = 'all' | 'upcoming' | 'bay' | 'ready' | 'done';
const IN: Record<Filter, Booking['status'][]> = {
  all: ['booked', 'in_progress', 'ready', 'completed', 'cancelled'],
  upcoming: ['booked'],
  bay: ['in_progress'],
  ready: ['ready'],
  done: ['completed', 'cancelled'],
};

/** The next one-tap step for a booking on the board. */
function nextStep(b: Booking): { label: string; body: StaffAction } | null {
  if (b.status === 'booked') return { label: 'Check in', body: { action: 'check_in', booking_id: b.id } };
  if (b.status === 'in_progress') {
    const i = b.stage ? STAGES.indexOf(b.stage) : -1;
    if (i >= 0 && i < STAGES.length - 1) return { label: STAGES[i + 1], body: { action: 'stage', booking_id: b.id, stage: STAGES[i + 1] } };
    return { label: 'Mark ready', body: { action: 'ready', booking_id: b.id } };
  }
  if (b.status === 'ready') return { label: 'Picked up', body: { action: 'complete', booking_id: b.id } };
  return null;
}

const STATUS: Record<Booking['status'], [string, 'soft' | 'ink' | 'ghost' | 'ok']> = {
  booked: ['Booked', 'ghost'], in_progress: ['In bay', 'soft'], ready: ['Ready', 'ok'], completed: ['Picked up', 'ghost'], cancelled: ['Cancelled', 'ghost'],
};

/** Today's bay: every booking for a day, with the next step one tap away. */
export default function Bay() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isStaff = useIsStaff();
  const notify = useStore((s) => s.notify);
  const [day, setDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [filter, setFilter] = useState<Filter>('all');
  const [list, setList] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await bookingsForDay(day));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [day]);

  useEffect(() => {
    if (!isStaff) return;
    let alive = true;
    const run = () =>
      bookingsForDay(day).then(
        (l) => { if (alive) { setList(l); setError(null); } },
        (e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); },
      );
    void run();
    const stop = listenToBay(() => void run());
    return () => { alive = false; stop(); };
  }, [isStaff, day]);

  if (isStaff === undefined) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator /></View>;
  if (!isStaff) return <View style={{ flex: 1, padding: 24, backgroundColor: c.bg }}><T>This area is for Fore Wheels staff.</T></View>;

  const shift = (n: number) => setDay((d) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; });
  const isToday = new Date().toDateString() === day.toDateString();
  const shown = (list ?? []).filter((b) => IN[filter].includes(b.status));
  const count = (f: Filter) => (list ?? []).filter((b) => IN[f].includes(b.status)).length;

  const step = async (b: Booking) => {
    const s = nextStep(b);
    if (!s) return;
    setBusy(b.id);
    try {
      await staffAct(s.body);
      notify(`${b.memberName ?? 'Member'}: ${s.label.toLowerCase()} done`);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Row>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous day" hitSlop={10}><T size={24} color={c.accent}>‹</T></Pressable>
        <View style={{ alignItems: 'center' }}>
          <T size={20} weight="bold">{isToday ? 'Today' : day.toLocaleDateString('en-CA', { weekday: 'long' })}</T>
          <T size={13} muted>{day.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}</T>
        </View>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next day" hitSlop={10}><T size={24} color={c.accent}>›</T></Pressable>
      </Row>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([['upcoming', 'To check in'], ['bay', 'In bay'], ['ready', 'Ready']] as [Filter, string][]).map(([f, l]) => (
          <View key={f} style={{ flex: 1, backgroundColor: c.card, borderRadius: 16, padding: 12, ...shadow(c.shadow, 0.08, 10) }}>
            <T size={24} weight="bold">{count(f)}</T>
            <T size={12} muted>{l}</T>
          </View>
        ))}
      </View>

      <Segmented label="Show" value={filter} onChange={setFilter} options={[['all', 'All'], ['upcoming', 'Booked'], ['bay', 'In bay'], ['ready', 'Ready'], ['done', 'Done']]} />

      {error && <T color={c.danger}>{error}</T>}
      {list === null && !error && <ActivityIndicator style={{ marginTop: 30 }} />}
      {list && shown.length === 0 && <T muted style={{ textAlign: 'center', paddingVertical: 30 }}>No bookings here.</T>}

      {shown.map((b) => {
        const s = nextStep(b);
        const [label, kind] = STATUS[b.status];
        return (
          <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/staff/[id]', params: { id: b.id } })}
            style={({ pressed }) => [{ backgroundColor: c.card, borderRadius: 22, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 }, shadow(c.shadow, 0.1, 12)]}>
            <Row>
              <View style={{ flex: 1 }}>
                <T size={13} weight="bold" color={c.accent}>Tee {clock(new Date(b.teeTime))}{b.stall ? ` · Stall ${b.stall}` : ''}</T>
                <T size={17} weight="bold">{b.memberName || 'Member'}</T>
                <T size={13} muted>{TIERS[b.tier].name} · {b.vehicleLabel || (b.size === 'suv' ? 'SUV / Truck' : 'Car')} · keys {b.keys === 'proshop' ? 'at pro shop' : 'in car'}</T>
                {b.addons.length > 0 && <T size={12.5} muted>Extras: {b.addons.join(', ')}</T>}
                {b.status === 'in_progress' && b.stage && <T size={12.5} weight="semibold">Now: {b.stage}</T>}
              </View>
              <Pill label={label} kind={kind} />
            </Row>
            {s && <Button title={busy === b.id ? 'Saving…' : s.label} small disabled={busy !== null} onPress={() => void step(b)} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
