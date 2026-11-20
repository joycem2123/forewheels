import { dollars, money, PLAN_ORDER, PLANS, TIERS, type PlanId, type VehicleSize } from '@forewheels/engine';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, CornerBubbles, Pill, Row, Screen, Segmented, T, Title, shadow } from '@/components/ui';
import { useStore } from '@/store/store';
import { BRAND, useColors } from '@/theme';

export default function Passes() {
  const c = useColors();
  const member = useStore((s) => s.data.member);
  const changePlan = useStore((s) => s.changePlan);
  const notify = useStore((s) => s.notify);
  const [size, setSize] = useState<VehicleSize>(member.vehicle.size);
  const [confirm, setConfirm] = useState<PlanId | null>(null);
  const [busy, setBusy] = useState(false);

  async function doSwitch(id: PlanId) {
    setBusy(true);
    try {
      await changePlan(id);
      setConfirm(null);
      notify(id === 'payg' ? "Pass ended. You'll pay per service." : `You're on the ${PLANS[id].name}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Passes</Title>
      <Segmented label="Vehicle size" value={size} onChange={setSize} options={[['car', 'Car'], ['suv', 'SUV / Truck']]} />

      {PLAN_ORDER.map((id) => {
        const p = PLANS[id];
        const cur = member.plan === id;
        const season = id === 'season';
        const price = p.price[size];
        const value = p.retailValue?.[size];
        const fg = season ? '#FFFFFF' : c.text;
        const sub = season ? '#E2DBFF' : c.muted;
        return (
          <View key={id} style={[{ backgroundColor: season ? BRAND : c.card, borderRadius: 28, padding: 18, gap: 8, overflow: 'hidden', borderWidth: 2, borderColor: cur ? (season ? '#FFFFFF' : c.text) : 'transparent' }, shadow(c.shadow, 0.12, 14)]}>
            {season && <CornerBubbles big={130} />}
            <Row>
              <T size={18} weight="semibold" color={fg}>{p.name}</T>
              {cur ? <Pill label="Current" kind={season ? 'white' : 'ink'} />
                : value ? <Pill label={`Save ${Math.round((1 - price / value) * 100)}%`} kind={season ? 'white' : 'soft'} />
                : <T size={12.5} color={sub}>No commitment</T>}
            </Row>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <T size={38} weight="bold" color={fg} style={{ letterSpacing: -1, lineHeight: 42 }}>{id === 'payg' ? dollars(TIERS.express.price[size]) : dollars(price)}</T>
              <T size={15} weight="medium" color={sub}>{id === 'payg' ? 'and up, per service' : `/ ${p.period}`}</T>
            </View>
            {value ? <T size={12.5} color={sub}>{dollars(value)} of services if you use them all</T> : null}
            <View style={{ gap: 4 }}>
              {p.includes.map((x) => (
                <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: season ? '#FFFFFF' : c.accent }} />
                  <T size={13} color={fg}>{x}</T>
                </View>
              ))}
            </View>
            {!cur && (confirm === id ? (
              <View style={{ backgroundColor: season ? 'rgba(255,255,255,0.95)' : c.accentSoft, borderRadius: 16, padding: 12, gap: 10, marginTop: 4 }}>
                <T size={13.5} color="#1F1A3A" style={!season && { color: c.text }}>
                  {id === 'payg'
                    ? 'End your pass? Credits you have left stay valid until it renews.'
                    : `Switch to the ${p.name} for ${money(price)} plus GST? It's charged to your ${member.defaultPayment === 'club' ? 'club account' : 'saved payment method'} today.`}
                </T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="Not now" kind="ghost" small style={{ flex: 1 }} onPress={() => setConfirm(null)} />
                  <Button title={busy ? 'Working…' : id === 'payg' ? 'End pass' : 'Confirm'} small disabled={busy} style={{ flex: 1 }} onPress={() => doSwitch(id)} />
                </View>
              </View>
            ) : (
              <Button title={id === 'payg' ? 'Switch to pay as you go' : `Switch to ${p.name}`} kind={season ? 'white' : 'primary'} small style={{ marginTop: 4, paddingVertical: 12 }} onPress={() => setConfirm(id)} />
            ))}
          </View>
        );
      })}
      <T size={12.5} muted>Prices before 5% GST. Season Pass runs May 1 to October 15.</T>
    </Screen>
  );
}
