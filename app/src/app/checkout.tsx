import { clock, FREE_CANCEL_HOURS, medDate, money, paymentMethods, quoteFor, relDay, TIERS, type Booking, type PaymentMethod } from '@forewheels/engine';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, DateTile, Row, T } from '@/components/ui';
import { useStore } from '@/store/store';
import { BRAND, useColors } from '@/theme';

export default function Checkout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const draft = useStore((s) => s.draft);
  const data = useStore((s) => s.data);
  const book = useStore((s) => s.book);
  const notify = useStore((s) => s.notify);
  const [method, setMethod] = useState<PaymentMethod>(draft?.paymentMethod ?? 'apple');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);

  if (!draft) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 16, backgroundColor: c.bg }}>
        <T>Nothing to review. Choose a service and tee time first.</T>
        <Button title="Back to booking" onPress={() => router.back()} />
      </View>
    );
  }

  const member = data.member;
  const t = TIERS[draft.tier];
  const tee = new Date(draft.teeTime);
  const freeUntil = new Date(tee.getTime() - FREE_CANCEL_HOURS * 3600000);
  const freeDay = relDay(freeUntil);
  const q = quoteFor(data, draft);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const b = await book({ ...draft!, paymentMethod: method });
      setDone(b);
      notify(b.paid > 0 ? `Paid ${money(b.paid)}` : 'Booked with a pass credit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment did not go through. Try again or pick another payment method.');
    } finally {
      setBusy(false);
    }
  }

  const wrap = { padding: 20, paddingBottom: insets.bottom + 24, gap: 14 };

  if (done) {
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={wrap}>
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 10 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
            <T size={34} weight="bold" color="#FFFFFF">✓</T>
            <View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: c.bubble, right: -14, top: -6 }} />
          </View>
          <T size={24} weight="bold" style={{ marginTop: 8 }}>You’re booked</T>
          <T muted>{t.name} · {relDay(tee)} · Tee {clock(tee)}</T>
        </View>
        <Row><T>Charged</T><T weight="semibold">{done.paid > 0 ? money(done.paid) : '$0.00 · pass credit used'}</T></Row>
        {done.paymentRef && <Row><T muted>Reference</T><T muted>{done.paymentRef}</T></Row>}
        <View style={{ backgroundColor: c.accentSoft, borderRadius: 14, padding: 12 }}>
          <T size={13} muted>Park, drop your keys{done.keys === 'proshop' ? ' at the pro shop' : ''} and head to the first tee. We’ll text you when we start and when your car is ready.</T>
        </View>
        <Button title="View my bookings" onPress={() => { router.back(); router.navigate('/bookings'); }} />
        <Button title="Back to home" kind="ghost" onPress={() => { router.back(); router.navigate('/'); }} />
      </ScrollView>
    );
  }

  const labels: Record<PaymentMethod, [string, string]> = {
    club: ['Club member account', `Member #${member.memberNo} · added to your club bill`],
    apple: ['Apple Pay', ''],
    card: member.card ? [`${member.card.brand} •••• ${member.card.last4}`, `Expires ${member.card.exp}`] : ['Card', ''],
  };
  const methods: [PaymentMethod, string, string][] = paymentMethods(member).map((k) => [k, ...labels[k]]);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={wrap}>
      <T size={24} weight="bold">Review &amp; pay</T>

      <View style={{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <DateTile date={tee} />
        <View style={{ flex: 1 }}>
          <T weight="bold">{t.name}</T>
          <T size={12.5} muted>{medDate(tee)} · Tee {clock(tee)} · {draft.size === 'suv' ? 'SUV / Truck' : 'Car'}</T>
          <T size={12.5} muted>{draft.stall ? `Stall ${draft.stall.toUpperCase()}` : 'Add your stall when you park'} · {draft.keys === 'proshop' ? 'keys at pro shop' : 'car left unlocked'}</T>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {q.lines.map((l) => (
          <Row key={l.label}>
            <T style={{ flex: 1 }}>{l.label}{l.note ? <T muted> ({l.note})</T> : null}</T>
            <T weight="semibold">{l.amount === 0 ? 'Included' : money(l.amount)}</T>
          </Row>
        ))}
        <Row><T muted>GST 5%</T><T muted>{money(q.gst)}</T></Row>
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.bubble, paddingTop: 10 }}>
          <Row><T size={17} weight="bold">Total</T><T size={17} weight="bold">{money(q.total)}</T></Row>
        </View>
      </View>

      {q.total > 0 && (
        <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Payment method">
          {methods.map(([k, label, sub]) => {
            const on = method === k;
            return (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setMethod(k)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1.5, borderColor: on ? c.accent : c.border }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 6 : 2, borderColor: on ? c.accent : c.bubble }} />
                <View style={{ flex: 1 }}>
                  <T weight="semibold">{label}</T>
                  {sub ? <T size={12} muted>{sub}</T> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {error && <T size={13} weight="semibold" color={c.danger}>{error}</T>}
      <Button title={busy ? 'Processing…' : q.total > 0 ? `Pay ${money(q.total)}` : 'Confirm booking'} disabled={busy} onPress={pay} />
      <T size={12} muted style={{ textAlign: 'center' }}>
        Free cancellation until {clock(freeUntil)} {freeDay === 'Today' || freeDay === 'Tomorrow' ? freeDay.toLowerCase() : `on ${freeDay}`} ({FREE_CANCEL_HOURS} hours before tee time).
      </T>
    </ScrollView>
  );
}
