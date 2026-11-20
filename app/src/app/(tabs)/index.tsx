import { clock, monthDay, PLANS, progress, relDay, shortClock, TIERS, type Booking, type TierId } from '@forewheels/engine';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Bubbles, Button, Card, CornerBubbles, CreditBadge, Logo, Pill, Row, Screen, T } from '@/components/ui';
import { useNow } from '@/lib/use-now';
import { useStore } from '@/store/store';
import { BRAND, useColors } from '@/theme';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** "in 45 min", "in 3 hrs", "tomorrow", "in 4 days". */
function until(at: Date, now: number): string {
  const mins = Math.round((at.getTime() - now) / 60000);
  if (mins < 60) return `in ${Math.max(mins, 1)} min`;
  const hrs = Math.round(mins / 60);
  if (relDay(at, new Date(now)) === 'Today') return `in ${hrs} hr${hrs === 1 ? '' : 's'}`;
  if (relDay(at, new Date(now)) === 'Tomorrow') return 'tomorrow';
  return `in ${Math.round(hrs / 24)} days`;
}

const lastStaffNote = (b: Booking) => [...(b.updates ?? [])].reverse().find((u) => u.byStaff)?.message;

export default function Home() {
  const c = useColors();
  const now = useNow();
  const { member, bookings } = useStore((s) => s.data);
  const live = bookings.find((b) => b.status === 'in_progress' || b.status === 'ready');
  const upcoming = bookings.filter((b) => b.status === 'booked' && new Date(b.teeTime).getTime() > now - 3 * 3600000).sort((a, b) => a.teeTime.localeCompare(b.teeTime));
  const next = upcoming[0];
  const p = live ? progress(live, now) : null;
  const ex = member.credits.express;
  const sig = member.credits.signature;
  const gifts = Object.entries(member.gifts ?? {}).filter(([, n]) => (n ?? 0) > 0) as [TierId, number][];
  // The first card: the car being detailed now, else the next wash, else an invitation to book.
  const others = live ? upcoming : upcoming.slice(1);

  return (
    <Screen>
      <Row><Logo /><Pill label={PLANS[member.plan].name} /></Row>

      <View>
        <T size={27} weight="semibold" style={{ letterSpacing: -0.5, lineHeight: 32 }}>
          {live ? `Hey ${member.firstName || 'there'}, enjoy the round.` : next ? `Hey ${member.firstName || 'there'}, you're booked.` : `Hey ${member.firstName || 'there'}, ready for your next round?`}
        </T>
        <T size={27} weight="semibold" color={c.accent} style={{ letterSpacing: -0.5, lineHeight: 32 }}>
          {live ? "We've got the car." : next ? 'We’ll have it shining.' : 'We’ll handle the car.'}
        </T>
      </View>

      {live && p ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Your car's progress" onPress={() => router.navigate('/bookings')}
          style={{ backgroundColor: BRAND, borderRadius: 34, padding: 20, overflow: 'hidden' }}>
          <CornerBubbles />
          <T size={12.5} weight="semibold" color="rgba(255,255,255,0.85)">Stall {live.stall || '—'} · {TIERS[live.tier].name}</T>
          <T size={22} weight="semibold" color="#FFFFFF" style={{ marginTop: 4, marginBottom: 14 }}>
            {live.status === 'ready' ? 'Your car is ready' : `${p.stage} in progress`}
          </T>
          <Bubbles pct={p.pct} />
          <Row style={{ marginTop: 14, alignItems: 'baseline' }}>
            <T size={13} weight="semibold" color="#FFFFFF">{live.status === 'ready' ? 'All done' : `${Math.round(p.pct * 100)}% done`}</T>
            <T size={13} weight="semibold" color="#FFFFFF">
              {live.status === 'ready'
                ? `Keys ${live.keys === 'proshop' ? 'at the pro shop' : 'in the car'}`
                : <>Ready about <T size={19} weight="bold" color="#FFFFFF">{p.readyAt ? shortClock(p.readyAt) : ''}</T></>}
            </T>
          </Row>
          {lastStaffNote(live) ? (
            <View style={{ marginTop: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 12 }}>
              <T size={13.5} color="#FFFFFF">“{lastStaffNote(live)}”</T>
            </View>
          ) : null}
        </Pressable>
      ) : next ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Your next wash" onPress={() => router.navigate('/bookings')}
          style={{ backgroundColor: BRAND, borderRadius: 34, padding: 20, overflow: 'hidden', gap: 14 }}>
          <CornerBubbles />
          <Row>
            <T size={12.5} weight="bold" color="rgba(255,255,255,0.85)" style={{ letterSpacing: 1.2 }}>YOUR NEXT WASH</T>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <T size={12} weight="bold" color="#5638E0">{until(new Date(next.teeTime), now)}</T>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 74, height: 80, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <T size={12} weight="bold" color="#6A4DF4" style={{ letterSpacing: 0.8 }}>{relDay(new Date(next.teeTime), new Date(now)) === 'Today' ? 'TODAY' : DAYS[new Date(next.teeTime).getDay()]}</T>
              <T size={32} weight="bold" color="#1F1A3A" style={{ lineHeight: 36 }}>{new Date(next.teeTime).getDate()}</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={24} weight="bold" color="#FFFFFF" style={{ lineHeight: 28 }}>{TIERS[next.tier].name}</T>
              <T size={15} weight="semibold" color="#FFFFFF">Tee {clock(new Date(next.teeTime))}</T>
              <T size={13} color="rgba(255,255,255,0.85)">
                {next.stall ? `Stall ${next.stall}` : 'Add your stall when you park'} · {next.keys === 'proshop' ? 'keys at pro shop' : 'car left unlocked'}
              </T>
            </View>
          </View>
          {lastStaffNote(next) ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 12 }}>
              <T size={13.5} color="#FFFFFF">“{lastStaffNote(next)}”</T>
            </View>
          ) : null}
          <Row>
            <T size={13} weight="semibold" color="#FFFFFF">{next.usedCredit ? (next.creditSource === 'gift' ? 'Gifted wash' : 'Pass credit') : `Paid ${next.paid ? `$${next.paid.toFixed(2)}` : ''}`}</T>
            <T size={13} weight="bold" color="#FFFFFF">View or change ›</T>
          </Row>
        </Pressable>
      ) : (
        <View style={{ backgroundColor: BRAND, borderRadius: 34, padding: 20, overflow: 'hidden' }}>
          <CornerBubbles />
          <T size={12.5} weight="semibold" color="rgba(255,255,255,0.85)">No car in the bay right now</T>
          <T size={22} weight="semibold" color="#FFFFFF" style={{ marginTop: 4, marginBottom: 14 }}>Book a detail for your next tee time</T>
          <Bubbles pct={0} />
          <Button title="Book a detail" kind="white" onPress={() => router.navigate('/book')} style={{ marginTop: 14, alignSelf: 'flex-start' }} small />
        </View>
      )}

      {gifts.length > 0 && (
        <Card onPress={() => router.navigate('/book')} label="Gifted washes" style={{ borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.accentSoft, shadowOpacity: 0 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
            <T size={22} color="#FFFFFF">✦</T>
          </View>
          <View style={{ flex: 1 }}>
            <T weight="bold">{gifts.map(([t, n]) => `${n} free ${TIERS[t].name}${n > 1 ? 's' : ''}`).join(', ')}</T>
            <T size={12.5} muted>A gift from the Fore Wheels team. It’s used automatically on your next booking.</T>
          </View>
        </Card>
      )}

      {member.plan !== 'payg' && ex && (
        <Card onPress={() => router.navigate('/passes')} label="Your pass" style={{ borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <CreditBadge left={ex.of - ex.used} of={ex.of} />
          <View style={{ flex: 1 }}>
            <T weight="bold">Express Washes left</T>
            <T size={12.5} muted>
              {ex.of - ex.used} of {ex.of} {member.plan === 'monthly' ? 'this month' : 'this season'}{sig ? ` · ${sig.of - sig.used} Signature left` : ''}
            </T>
            <T size={12} muted>Renews {monthDay(new Date(member.planRenews))}</T>
          </View>
        </Card>
      )}

      {others.length > 0 && (
        <View style={{ gap: 10 }}>
          <T size={13} weight="bold" muted>{live ? 'Coming up' : 'Also booked'}</T>
          {others.slice(0, 3).map((b) => (
            <Card key={b.id} onPress={() => router.navigate('/bookings')} label={`${TIERS[b.tier].name} booking`} style={{ backgroundColor: c.accentSoft, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 12, shadowOpacity: 0, padding: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                <T size={9.5} weight="bold" color={c.accent}>{DAYS[new Date(b.teeTime).getDay()]}</T>
                <T size={17} weight="bold" style={{ lineHeight: 19 }}>{new Date(b.teeTime).getDate()}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T weight="bold">{TIERS[b.tier].name}</T>
                <T size={12.5} muted>Tee {clock(new Date(b.teeTime))} · {b.usedCredit ? 'free wash' : 'paid'}</T>
              </View>
              <T size={22} color={c.accent}>›</T>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
