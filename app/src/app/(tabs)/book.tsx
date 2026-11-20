import {
  ADDONS,
  addonAllowed,
  atSlot,
  dayShort,
  hasCredit,
  money,
  PLANS,
  quoteFor,
  slotFull,
  slotLabel,
  TEE_TIMES,
  TIER_ORDER,
  TIERS,
  type AddonId,
  type KeyHandoff,
  type TierId,
  type VehicleSize,
} from '@forewheels/engine';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Screen, Section, Segmented, T, TierMark, Title, shadow } from '@/components/ui';
import { useNow } from '@/lib/use-now';
import { useStore } from '@/store/store';
import { fonts, useColors } from '@/theme';

export default function Book() {
  const c = useColors();
  const now = useNow();
  const data = useStore((s) => s.data);
  const setDraft = useStore((s) => s.setDraft);
  const member = data.member;
  const plan = PLANS[member.plan];

  const todayKey = new Date(now).setHours(0, 0, 0, 0);
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const d = new Date(todayKey);
    d.setDate(d.getDate() + i);
    return d;
  }), [todayKey]);

  const [size, setSize] = useState<VehicleSize>(member.vehicle.size);
  const [tier, setTier] = useState<TierId>('signature');
  const [dayIdx, setDayIdx] = useState(1);
  const [slot, setSlot] = useState('08:00');
  const [addons, setAddons] = useState<AddonId[]>([]);
  const [stall, setStall] = useState('');
  const [keys, setKeys] = useState<KeyHandoff>('proshop');

  const day = days[dayIdx];
  const slotOk = (s: string) => atSlot(day, s).getTime() > now + 30 * 60000 && !slotFull(day, s);
  const chosen = slotOk(slot) ? slot : null;
  const cleanAddons = addons.filter((a) => addonAllowed(a, tier));
  const q = quoteFor(data, { tier, size, addons: cleanAddons });

  const review = () => {
    if (!chosen) return;
    setDraft({ tier, size, teeTime: atSlot(day, chosen).toISOString(), stall, keys, addons: cleanAddons, paymentMethod: member.defaultPayment });
    router.push('/checkout');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen bottom={190}>
        <Title>Book a detail</Title>
        <Segmented label="Vehicle size" value={size} onChange={setSize} options={[['car', 'Car'], ['suv', 'SUV / Truck']]} />

        <Section>Choose a service</Section>
        {TIER_ORDER.map((id) => {
          const t = TIERS[id];
          const credit = member.plan !== 'payg' && hasCredit(member.credits, id);
          const disc = !credit && plan.discountTiers.includes(id) ? plan.discount : 0;
          const on = tier === id;
          const price = t.price[size] * (1 - disc);
          return (
            <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setTier(id)}
              style={[{ backgroundColor: c.card, borderRadius: 20, borderWidth: 1.5, borderColor: on ? c.accent : c.border, padding: 14, gap: 10 }, on && shadow(c.accent, 0.25, 16)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TierMark tier={id} />
                <View style={{ flex: 1 }}>
                  <T size={16} weight="semibold">{t.name}</T>
                  <T size={12.5} muted>{t.minutes < 60 ? `${t.minutes} min` : `${t.minutes / 60} hr`} · {t.includes.slice(id === 'express' ? 0 : 1, id === 'express' ? 2 : 3).join(', ').toLowerCase()}</T>
                </View>
                {credit
                  ? <T size={13} weight="bold" color={c.accent}>Included</T>
                  : <T size={17} weight="bold">{Number.isInteger(price) ? `$${price}` : money(price)}</T>}
              </View>
              {on && (
                <View style={{ paddingLeft: 60, gap: 2 }}>
                  {[...t.includes, ...(t.note ? [t.note] : [])].map((x) => (
                    <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
                      <T size={12.5} muted>{x}</T>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}

        <Section>Tee day</Section>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {days.map((d, i) => {
            const on = i === dayIdx;
            return (
              <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setDayIdx(i)}
                style={{ width: 56, paddingVertical: 9, borderRadius: 16, alignItems: 'center', backgroundColor: on ? c.dark : c.card, borderWidth: 1, borderColor: on ? c.dark : c.border }}>
                <T size={11} weight="semibold" color={on ? c.darkMuted : c.muted}>{i === 0 ? 'TODAY' : dayShort(d).toUpperCase()}</T>
                <T size={18} weight="bold" color={on ? '#FFFFFF' : c.text}>{d.getDate()}</T>
              </Pressable>
            );
          })}
        </ScrollView>

        <Section>Tee time</Section>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TEE_TIMES.map((s) => {
            const ok = slotOk(s);
            const on = chosen === s;
            return (
              <Pressable key={s} disabled={!ok} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !ok }}
                accessibilityLabel={`${slotLabel(s)}${ok ? '' : ', unavailable'}`} onPress={() => setSlot(s)}
                style={{ width: '22.9%', paddingVertical: 9, borderRadius: 12, alignItems: 'center', backgroundColor: on ? c.accent : c.card, borderWidth: 1, borderColor: on ? c.accent : c.border, opacity: ok ? 1 : 0.35 }}>
                <T size={13} weight="semibold" color={on ? '#FFFFFF' : c.text} style={!ok && { textDecorationLine: 'line-through' }}>{slotLabel(s)}</T>
              </Pressable>
            );
          })}
        </View>
        {tier === 'pro' && (
          <View style={{ backgroundColor: c.accentSoft, borderRadius: 14, padding: 12 }}>
            <T size={12.5} muted>Pro Detail takes about 3.5 hours. Book it for an 18-hole round.</T>
          </View>
        )}

        <Section>Extras{plan.discount ? ` · ${Math.round(plan.discount * 100)}% off with your pass` : ''}</Section>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ADDONS.map((a) => {
            const allowed = addonAllowed(a.id, tier);
            const on = cleanAddons.includes(a.id);
            return (
              <Pressable key={a.id} disabled={!allowed} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !allowed }}
                onPress={() => setAddons((x) => (x.includes(a.id) ? x.filter((y) => y !== a.id) : [...x, a.id]))}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.card, opacity: allowed ? 1 : 0.4 }}>
                <T size={12.5} weight="semibold" color={on ? c.accentInk : c.text}>{a.name} · ${a.price}</T>
              </Pressable>
            );
          })}
        </View>

        <Section>Parking stall (optional)</Section>
        <TextInput
          value={stall}
          onChangeText={setStall}
          placeholder="e.g. B-14, or add it when you park"
          placeholderTextColor={c.muted}
          autoCapitalize="characters"
          maxLength={8}
          accessibilityLabel="Parking stall"
          style={{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 15, color: c.text }}
        />
        <Section>Keys</Section>
        <Segmented label="Key handoff" value={keys} onChange={setKeys} options={[['proshop', 'Pro shop key drop'], ['unlocked', 'Leave car unlocked']]} />
      </Screen>

      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 12, backgroundColor: c.dark, borderRadius: 22, paddingVertical: 12, paddingLeft: 18, paddingRight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow('#1F1A3A', 0.35, 20) }}>
        <View>
          <T size={12} color={c.darkMuted}>{q.usesCredit && q.total === 0 ? 'Pass credit' : 'Total incl. GST'}</T>
          <T size={20} weight="bold" color="#FFFFFF">{money(q.total)}</T>
        </View>
        <Pressable accessibilityRole="button" disabled={!chosen} onPress={review}
          style={({ pressed }) => ({ backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, opacity: !chosen ? 0.5 : pressed ? 0.85 : 1 })}>
          <T weight="bold" color="#1F1A3A">{chosen ? 'Review' : 'Pick a time'}</T>
        </Pressable>
      </View>
    </View>
  );
}
