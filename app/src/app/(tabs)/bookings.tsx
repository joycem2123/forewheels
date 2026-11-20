import { cancelTerms, clock, medDate, money, progress, relDay, shortClock, TIERS, type Booking } from '@forewheels/engine';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Bubbles, Button, Card, DateTile, Pill, Row, Screen, Segmented, T, Title } from '@/components/ui';
import { useNow } from '@/lib/use-now';
import { useStore } from '@/store/store';
import { useColors } from '@/theme';

export default function Bookings() {
  const c = useColors();
  const now = useNow();
  const bookings = useStore((s) => s.data.bookings);
  const cancel = useStore((s) => s.cancel);
  const notify = useStore((s) => s.notify);
  const [view, setView] = useState<'up' | 'past'>('up');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upcoming = bookings.filter((b) => ['booked', 'in_progress', 'ready'].includes(b.status)).sort((a, b) => a.teeTime.localeCompare(b.teeTime));
  const past = bookings.filter((b) => ['completed', 'cancelled'].includes(b.status)).sort((a, b) => b.teeTime.localeCompare(a.teeTime));

  async function doCancel(id: string) {
    setBusy(true);
    try {
      notify(await cancel(id));
      setConfirming(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not cancel. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function terms(b: Booking) {
    const t = cancelTerms(b, new Date(now));
    if (t.kind === 'free') return `You're more than 2 hours from tee time, so there's no fee. ${t.returnsCredit ? 'Your pass credit comes back.' : `You'll be refunded ${money(t.refund)}.`}`;
    if (t.kind === 'late') return b.usedCredit
      ? "It's less than 2 hours to tee time, so the pass credit is used."
      : `It's less than 2 hours to tee time, so a $20 late fee applies. You'll be refunded ${money(t.refund)}.`;
    return '';
  }

  return (
    <Screen>
      <Title>Bookings</Title>
      <Segmented label="Show" value={view} onChange={setView} options={[['up', `Upcoming (${upcoming.length})`], ['past', 'Past']]} />

      {view === 'up' && upcoming.length === 0 && (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 30 }}>
          <T muted>No upcoming bookings.</T>
          <Button title="Book a detail" kind="ghost" small onPress={() => router.navigate('/book')} />
        </View>
      )}

      {view === 'up' && upcoming.map((b) => {
        const tee = new Date(b.teeTime);
        const live = b.status === 'in_progress' || b.status === 'ready';
        const p = progress(b, now);
        const today = relDay(tee, new Date(now)) === 'Today';
        return (
          <Card key={b.id} style={{ gap: 12, padding: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <DateTile date={tee} accent={live} label={today ? 'TODAY' : undefined} />
              <View style={{ flex: 1 }}>
                <Row>
                  <T weight="bold" style={{ flexShrink: 1 }}>{TIERS[b.tier].name}</T>
                  {b.status === 'in_progress' && <Pill label="In progress" />}
                  {b.status === 'ready' && <Pill label="Ready" kind="ok" />}
                  {b.status === 'booked' && <Pill label="Booked" kind="ghost" />}
                </Row>
                <T size={12.5} muted>
                  {live
                    ? `Stall ${b.stall || '—'} · ${b.status === 'ready' ? 'ready for pickup' : `ready about ${p.readyAt ? shortClock(p.readyAt) : ''}`}`
                    : `Tee ${clock(tee)} · ${b.usedCredit ? 'pass credit' : `paid ${money(b.paid)}`}${b.stall ? ` · stall ${b.stall}` : ''}`}
                </T>
              </View>
            </View>
            {live && <Bubbles pct={p.pct} small />}
            {live && <T size={12} muted>Work has started, so this booking can’t be cancelled.</T>}
            {b.status === 'booked' && (confirming === b.id ? (
              <View style={{ backgroundColor: c.dangerSoft, borderRadius: 16, padding: 12, gap: 10 }}>
                <T size={13} weight="bold">Cancel {today ? "today's" : `${medDate(tee).split(',')[0]}'s`} {TIERS[b.tier].name}?</T>
                <T size={13} muted>{terms(b)}</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="Keep it" kind="ghost" small style={{ flex: 1 }} onPress={() => setConfirming(null)} />
                  <Button title={busy ? 'Cancelling…' : 'Cancel booking'} kind="dangerFill" small disabled={busy} style={{ flex: 1 }} onPress={() => doCancel(b.id)} />
                </View>
              </View>
            ) : (
              <Row style={{ justifyContent: 'flex-end' }}>
                <Button title="Cancel" kind="danger" small onPress={() => setConfirming(b.id)} />
              </Row>
            ))}
          </Card>
        );
      })}

      {view === 'past' && (past.length === 0 ? (
        <T muted style={{ textAlign: 'center', paddingVertical: 30 }}>No past bookings yet.</T>
      ) : (
        <View>
          {past.map((b) => (
            <Row key={b.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border }}>
              <View style={{ flex: 1 }}>
                <T weight="bold">{TIERS[b.tier].name}</T>
                <T size={13} muted>
                  {medDate(new Date(b.teeTime))} · {b.status === 'cancelled'
                    ? (b.refund ? `cancelled, ${money(b.refund)} refunded` : 'cancelled')
                    : b.usedCredit ? 'pass credit' : b.paymentMethod === 'club' ? 'club account' : b.paymentMethod === 'apple' ? 'Apple Pay' : 'card'}
                </T>
              </View>
              <T weight="bold">{money(b.status === 'cancelled' ? Math.max(0, b.paid - (b.refund ?? 0)) : b.paid)}</T>
            </Row>
          ))}
        </View>
      ))}
    </Screen>
  );
}
