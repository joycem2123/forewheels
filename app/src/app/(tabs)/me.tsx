import { monthDay, PLANS, type Member, type PaymentMethod } from '@forewheels/engine';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Row, Screen, Section, Segmented, T, Title, shadow } from '@/components/ui';
import { useStore } from '@/store/store';
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
  const reset = useStore((s) => s.reset);
  const notify = useStore((s) => s.notify);
  const payLabel: Record<PaymentMethod, string> = { club: 'Club member account', apple: 'Apple Pay', card: `${m.card.brand} •••• ${m.card.last4}` };
  const notifyRows: [keyof Member['notify'], string][] = [['started', 'Work starts on my car'], ['ready', 'My car is ready'], ['reminders', 'I have a tee time with no booking']];

  return (
    <Screen>
      <View>
        <Title>{m.firstName}</Title>
        <T muted>{m.club} · Member #{m.memberNo}</T>
      </View>

      <Section>Vehicle</Section>
      <Group>
        <Item><T>{m.vehicle.label}</T><T muted>{m.vehicle.plate}</T></Item>
        <View style={{ paddingVertical: 12 }}>
          <Segmented label="Vehicle size" value={m.vehicle.size} onChange={(size) => update({ vehicle: { ...m.vehicle, size } })} options={[['car', 'Car'], ['suv', 'SUV / Truck']]} />
        </View>
      </Group>

      <Section>Pass</Section>
      <Group>
        <Item last={m.plan === 'payg'} onPress={() => router.navigate('/passes')}><T>{PLANS[m.plan].name}</T><T weight="bold" color={c.accent}>Change</T></Item>
        {m.plan !== 'payg' && <Item last><T>Renews</T><T muted>{monthDay(new Date(m.planRenews))}</T></Item>}
      </Group>

      <Section>Default payment</Section>
      <Group>
        {(['club', 'apple', 'card'] as PaymentMethod[]).map((k, i) => {
          const on = m.defaultPayment === k;
          return (
            <Item key={k} last={i === 2} onPress={() => update({ defaultPayment: k })}>
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

      <Section>Help</Section>
      <Group>
        <Item><T>Cancellations</T><T muted size={13}>Free up to 2 hrs before tee time</T></Item>
        <Item><T>Questions</T><T muted size={13}>Ask at the pro shop</T></Item>
        <Item last onPress={() => { reset(); notify('Sample data restored'); }}><T>Sample data</T><T weight="bold" color={c.accent}>Restore</T></Item>
      </Group>
      <Row style={{ justifyContent: 'center' }}><T size={12} muted>Fore Wheels Detailing · version 1.0.0</T></Row>
    </Screen>
  );
}
