import { monthDay, paymentMethods, PLANS, type Member, type PaymentMethod } from '@forewheels/engine';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { AccountNeeded } from '@/components/account-needed';
import { Button, Row, Screen, Section, Segmented, T, Title, shadow } from '@/components/ui';
import { pushProfile, signOutToWelcome } from '@/sync/account-data';
import { useIsStaff } from '@/sync/staff';
import { useSignedIn, useStore } from '@/store/store';
import { useColors } from '@/theme';

function Group({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.card, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4 }, shadow(c.shadow, 0.1, 12)]}>{children}</View>;
}

function Item({ children, last, onPress }: { children: ReactNode; last?: boolean; onPress?: () => void }) {
  const c = useColors();
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderColor: c.border };
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={style}>{children}</Pressable> : <View style={style}>{children}</View>;
}

export default function Me() {
  const c = useColors();
  const m = useStore((s) => s.data.member);
  const update = useStore((s) => s.updateMember);
  const signedIn = useSignedIn();
  const isStaff = useIsStaff();
  const payLabel: Record<PaymentMethod, string> = { club: 'Club member account', apple: 'Apple Pay', card: m.card ? `${m.card.brand} •••• ${m.card.last4}` : 'Card' };
  const methods = paymentMethods(m);
  const notifyRows: [keyof Member['notify'], string][] = [['started', 'Work starts on my car'], ['ready', 'My car is ready'], ['reminders', 'I have a tee time with no booking']];
  const name = `${m.firstName} ${m.lastName ?? ''}`.trim();

  return (
    <Screen>
      <View>
        <Title>{signedIn ? name || 'Me' : 'Guest'}</Title>
        {signedIn && (m.club || m.memberNo) ? <T muted>{[m.club, m.memberNo && `Member #${m.memberNo}`].filter(Boolean).join(' · ')}</T> : null}
      </View>

      {!signedIn && <AccountNeeded what="book and save your details" />}

      {signedIn && isStaff && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/staff')}
          style={({ pressed }) => ({ backgroundColor: c.dark, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.85 : 1 })}>
          <View style={{ flex: 1 }}>
            <T size={12} weight="bold" color={c.darkMuted} style={{ letterSpacing: 1 }}>STAFF</T>
            <T size={18} weight="bold" color="#FFFFFF">Today’s bay</T>
            <T size={13} color={c.darkMuted}>Check cars in, update progress, refunds and gifts</T>
          </View>
          <T size={24} color="#FFFFFF">›</T>
        </Pressable>
      )}

      {signedIn && (
        <>
          <Section>Account</Section>
          <Group>
            <Item last onPress={() => router.push('/account')}><T>Account settings</T><T size={20} color={c.accent}>›</T></Item>
          </Group>
        </>
      )}

      <Section>Vehicle</Section>
      <Group>
        <Item><T>{m.vehicle.label || 'Your car'}</T><T muted>{m.vehicle.plate}</T></Item>
        <View style={{ paddingVertical: 12 }}>
          <Segmented label="Vehicle size" value={m.vehicle.size} onChange={(size) => { update({ vehicle: { ...m.vehicle, size } }); if (signedIn) void pushProfile().catch(() => undefined); }} options={[['car', 'Car'], ['suv', 'SUV / Truck']]} />
        </View>
      </Group>

      {signedIn && (
        <>
          <Section>Pass</Section>
          <Group>
            <Item last={m.plan === 'payg'} onPress={() => router.navigate('/passes')}><T>{PLANS[m.plan].name}</T><T weight="bold" color={c.accent}>Change</T></Item>
            {m.plan !== 'payg' && <Item last><T>Renews</T><T muted>{monthDay(new Date(m.planRenews))}</T></Item>}
          </Group>

          <Section>Default payment</Section>
          <Group>
            {methods.map((k, i) => {
              const on = m.defaultPayment === k;
              return (
                <Item key={k} last={i === methods.length - 1} onPress={() => update({ defaultPayment: k })}>
                  <T>{payLabel[k]}</T>
                  <View accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 6 : 2, borderColor: on ? c.accent : c.bubble }} />
                </Item>
              );
            })}
          </Group>

          <Section>Text me when</Section>
          <Group>
            {notifyRows.map(([k, label], i) => (
              <Item key={k} last={i === notifyRows.length - 1}>
                <T style={{ flex: 1 }}>{label}</T>
                <Switch accessibilityLabel={label} value={m.notify[k]} onValueChange={(v) => update({ notify: { ...m.notify, [k]: v } })} trackColor={{ true: c.accent, false: c.border }} />
              </Item>
            ))}
          </Group>
        </>
      )}

      <Section>Help</Section>
      <Group>
        <Item><T>Cancellations</T><T muted size={13}>Free up to 2 hrs before tee time</T></Item>
        <Item last><T>Questions</T><T muted size={13}>Ask at the pro shop</T></Item>
      </Group>
      {signedIn ? (
        <Button title="Sign out" kind="ghost" onPress={() => void signOutToWelcome().then(() => router.replace('/welcome'))} />
      ) : (
        <Button title="Sign in or create account" onPress={() => void signOutToWelcome().then(() => router.replace('/welcome'))} />
      )}
      <Row style={{ justifyContent: 'center' }}><T size={12} muted>Fore Wheels Detailing · version 1.0.0</T></Row>
    </Screen>
  );
}
