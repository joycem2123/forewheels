import { clock, medDate, money, STAGES, TIERS, type Booking, type TierId } from '@forewheels/engine';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '@/components/form';
import { Button, Pill, Row, Segmented, T, shadow } from '@/components/ui';
import { bookingDetail, listenToBay, staffAct, type StaffAction } from '@/sync/staff';
import { useStore } from '@/store/store';
import { useColors } from '@/theme';

const TEMPLATES = [
  'Your car is in the wash now.',
  'We’re running about 15 minutes behind. Thanks for your patience.',
  'Found something in your car. It’s waiting for you at the pro shop.',
  'Your keys are at the pro shop.',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: 22, padding: 16, gap: 12 }, shadow(c.shadow, 0.08, 12)]}>
      <T size={16} weight="bold">{title}</T>
      {children}
    </View>
  );
}

/** One booking, for staff: progress, messages, refunds, gifts and cancelling. */
export default function StaffBooking() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const notify = useStore((s) => s.notify);
  const [b, setB] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stall, setStall] = useState('');
  const [msg, setMsg] = useState('');
  const [amount, setAmount] = useState('');
  const [refundWhy, setRefundWhy] = useState('');
  const [giftTier, setGiftTier] = useState<TierId>('express');
  const [giftWhy, setGiftWhy] = useState('');
  const [askCancel, setAskCancel] = useState(false);
  const [cancelWhy, setCancelWhy] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await bookingDetail(id);
      setB(r.booking);
      setStall((s) => s || r.booking.stall);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);
  useEffect(() => {
    let alive = true;
    const run = () =>
      bookingDetail(id).then(
        (r) => { if (alive) { setB(r.booking); setStall((s) => s || r.booking.stall); } },
        (e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); },
      );
    void run();
    const stop = listenToBay(() => void run());
    return () => { alive = false; stop(); };
  }, [id]);

  const act = async (key: string, body: StaffAction, done: string, after?: () => void) => {
    setBusy(key);
    try {
      await staffAct(body);
      notify(done);
      after?.();
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <View style={{ flex: 1, padding: 24, backgroundColor: c.bg }}><T color={c.danger}>{error}</T></View>;
  if (!b) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator /></View>;

  const left = Math.round((b.paid - (b.refund ?? 0)) * 100) / 100;
  const amt = Number(amount.replace(/[^0-9.]/g, ''));
  const open = b.status === 'booked' || b.status === 'in_progress' || b.status === 'ready';
  const stageIdx = b.stage ? STAGES.indexOf(b.stage) : -1;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: b.memberName || 'Booking' }} />

      <Section title={`${TIERS[b.tier].name}`}>
        {[
          ['Member', b.memberName || '–'],
          ['Car', `${b.vehicleLabel || '–'} (${b.size === 'suv' ? 'SUV / Truck' : 'Car'})`],
          ['Tee time', `${medDate(new Date(b.teeTime))} · ${clock(new Date(b.teeTime))}`],
          ['Stall', b.stall || 'Not given yet'],
          ['Keys', b.keys === 'proshop' ? 'Pro shop key drop' : 'Left in the car (unlocked)'],
          ['Extras', b.addons.length ? b.addons.join(', ') : 'None'],
          ['Paid', b.usedCredit ? (b.creditSource === 'gift' ? 'Gifted wash' : 'Pass credit') : `${money(b.paid)}${b.paymentMethod ? ` · ${b.paymentMethod === 'club' ? 'club account' : b.paymentMethod === 'apple' ? 'Apple Pay' : 'card'}` : ''}`],
          ...(b.refund ? [['Refunded', `${money(b.refund)}${b.refundReason ? ` · ${b.refundReason}` : ''}`]] : []),
        ].map(([k, v]) => (
          <Row key={k} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, alignItems: 'flex-start' }}>
            <T muted>{k}</T>
            <T weight="semibold" style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
          </Row>
        ))}
      </Section>

      <Section title="Progress">
        <Row>
          <T muted>Status</T>
          <Pill label={{ booked: 'Booked', in_progress: `In bay${b.stage ? ` · ${b.stage}` : ''}`, ready: 'Ready', completed: 'Picked up', cancelled: 'Cancelled' }[b.status]} kind={b.status === 'ready' ? 'ok' : 'soft'} />
        </Row>
        {b.status === 'booked' && (
          <>
            <Field label="Stall" value={stall} onChangeText={setStall} placeholder="e.g. B-14" autoCapitalize="characters" />
            <Button title={busy === 'in' ? 'Saving…' : 'Check in and start'} disabled={busy !== null} onPress={() => void act('in', { action: 'check_in', booking_id: b.id, stall }, 'Checked in. Member notified.')} />
          </>
        )}
        {b.status === 'in_progress' && (
          <View style={{ gap: 8 }}>
            {STAGES.map((s, i) => (
              <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: i === stageIdx }} disabled={busy !== null}
                onPress={() => void act('stage', { action: 'stage', booking_id: b.id, stage: s }, `${s}. Member notified.`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: i === stageIdx ? c.accent : c.border, backgroundColor: i <= stageIdx ? c.accentSoft : c.card }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i <= stageIdx ? c.accent : c.border, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={12} weight="bold" color="#FFFFFF">{i < stageIdx ? '✓' : i + 1}</T>
                </View>
                <T weight={i === stageIdx ? 'bold' : 'regular'}>{s}</T>
              </Pressable>
            ))}
            <Button title={busy === 'ready' ? 'Saving…' : 'Mark ready for pickup'} disabled={busy !== null} onPress={() => void act('ready', { action: 'ready', booking_id: b.id }, 'Marked ready. Member notified.')} />
          </View>
        )}
        {b.status === 'ready' && (
          <Button title={busy === 'done' ? 'Saving…' : 'Picked up'} disabled={busy !== null} onPress={() => void act('done', { action: 'complete', booking_id: b.id }, 'Marked as picked up.')} />
        )}
      </Section>

      <Section title="Message the member">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TEMPLATES.map((t) => (
            <Pressable key={t} onPress={() => setMsg(t)} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
              <T size={12}>{t.length > 34 ? `${t.slice(0, 32)}…` : t}</T>
            </Pressable>
          ))}
        </View>
        <Field label="Message" value={msg} onChangeText={setMsg} placeholder="Shows in their app and as a notification" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
        <Button title={busy === 'msg' ? 'Sending…' : 'Send'} disabled={busy !== null || !msg.trim()} onPress={() => void act('msg', { action: 'message', booking_id: b.id, message: msg }, 'Message sent.', () => setMsg(''))} />
      </Section>

      <Section title="Refund">
        <T size={13} muted>{left > 0 ? `Up to ${money(left)} can be refunded on this booking.` : b.usedCredit ? 'This was a free wash, so there’s nothing to refund. Gift another wash instead.' : 'Nothing left to refund.'}</T>
        {left > 0 && (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Full" kind="ghost" small onPress={() => setAmount(left.toFixed(2))} />
              <Button title="Half" kind="ghost" small onPress={() => setAmount((left / 2).toFixed(2))} />
            </View>
            <Field label="Amount ($)" value={amount} onChangeText={setAmount} placeholder={left.toFixed(2)} keyboardType="decimal-pad" />
            <Field label="Reason (the member sees this)" value={refundWhy} onChangeText={setRefundWhy} placeholder="e.g. Missed a spot on the wheels." />
            <Button title={busy === 'refund' ? 'Refunding…' : `Refund ${amt > 0 ? money(amt) : ''}`} kind="danger" disabled={busy !== null || !(amt > 0) || amt > left || !refundWhy.trim()}
              onPress={() => void act('refund', { action: 'refund', booking_id: b.id, amount: amt, reason: refundWhy }, `Refunded ${money(amt)}.`, () => { setAmount(''); setRefundWhy(''); })} />
          </>
        )}
      </Section>

      <Section title="Gift a free wash">
        <T size={13} muted>For a member who wasn’t happy. It goes straight into their account and is used on their next booking of that service.</T>
        <Segmented label="Which wash" value={giftTier} onChange={setGiftTier} options={[['express', 'Express'], ['signature', 'Signature'], ['pro', 'Pro']]} />
        <Field label="Note to the member" value={giftWhy} onChangeText={setGiftWhy} placeholder="e.g. Sorry we missed the wheels today." />
        <Button title={busy === 'gift' ? 'Gifting…' : `Gift a free ${TIERS[giftTier].name}`} disabled={busy !== null || !giftWhy.trim()}
          onPress={() => void act('gift', { action: 'gift', booking_id: b.id, tier: giftTier, reason: giftWhy }, `Gifted a free ${TIERS[giftTier].name}.`, () => setGiftWhy(''))} />
      </Section>

      {open && b.status !== 'ready' && (
        <Section title="Cancel booking">
          {!askCancel ? (
            <Button title="Cancel this booking" kind="danger" onPress={() => setAskCancel(true)} />
          ) : (
            <View style={{ gap: 10 }}>
              <T size={13} muted>{b.usedCredit ? 'Their free wash goes back into their account.' : `${money(left)} is refunded in full.`} The member is told right away.</T>
              <Field label="Reason (the member sees this)" value={cancelWhy} onChangeText={setCancelWhy} placeholder="e.g. Course closed for frost." />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Keep it" kind="ghost" small style={{ flex: 1 }} onPress={() => setAskCancel(false)} />
                <Button title={busy === 'cancel' ? 'Cancelling…' : 'Cancel booking'} kind="dangerFill" small style={{ flex: 1 }} disabled={busy !== null}
                  onPress={() => void act('cancel', { action: 'cancel', booking_id: b.id, reason: cancelWhy }, 'Booking cancelled. Member notified.', () => setAskCancel(false))} />
              </View>
            </View>
          )}
        </Section>
      )}

      <Section title="Timeline">
        {(b.updates ?? []).length === 0 && <T muted>Nothing yet.</T>}
        {[...(b.updates ?? [])].reverse().map((u) => (
          <View key={u.id} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, gap: 2 }}>
            <T size={14}>{u.message}</T>
            <T size={11.5} muted>{medDate(new Date(u.at))} · {clock(new Date(u.at))}{u.byStaff ? ' · staff' : ' · member'}</T>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}
