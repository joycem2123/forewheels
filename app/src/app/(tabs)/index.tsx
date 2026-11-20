import { clock, monthDay, PLANS, progress, relDay, shortClock, TIERS } from '@forewheels/engine';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Bubbles, Button, Card, CornerBubbles, CreditBadge, Logo, Pill, Row, Screen, T } from '@/components/ui';
import { useNow } from '@/lib/use-now';
import { useStore } from '@/store/store';
import { BRAND, useColors } from '@/theme';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function Home() {
  const c = useColors();
  const now = useNow();
  const { member, bookings } = useStore((s) => s.data);
  const live = bookings.find((b) => b.status === 'in_progress' || b.status === 'ready');
  const next = bookings.filter((b) => b.status === 'booked').sort((a, b) => a.teeTime.localeCompare(b.teeTime))[0];
  const p = live ? progress(live, now) : null;
  const ex = member.credits.express;
  const sig = member.credits.signature;

  return (
    <Screen>
      <Row><Logo /><Pill label={PLANS[member.plan].name} /></Row>

      <View>
        <T size={27} weight="semibold" style={{ letterSpacing: -0.5, lineHeight: 32 }}>
          Hey {member.firstName}, {live ? 'enjoy the round.' : 'ready for your next round?'}
        </T>
        <T size={27} weight="semibold" color={c.accent} style={{ letterSpacing: -0.5, lineHeight: 32 }}>
          {live ? "We've got the car." : "We'll handle the car."}
        </T>
      </View>

      <View style={{ backgroundColor: BRAND, borderRadius: 34, padding: 20, overflow: 'hidden' }}>
        <CornerBubbles />
        {live && p ? (
          <>
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
          </>
        ) : (
          <>
            <T size={12.5} weight="semibold" color="rgba(255,255,255,0.85)">No car in the bay right now</T>
            <T size={22} weight="semibold" color="#FFFFFF" style={{ marginTop: 4, marginBottom: 14 }}>Book a detail for your next tee time</T>
            <Bubbles pct={0} />
            <Button title="Book a detail" kind="white" onPress={() => router.navigate('/book')} style={{ marginTop: 14, alignSelf: 'flex-start' }} small />
          </>
        )}
      </View>

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

      {next ? (
        <Card onPress={() => router.navigate('/bookings')} label="Next booking" style={{ backgroundColor: c.accentSoft, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 12, shadowOpacity: 0 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <T size={9.5} weight="bold" color={c.accent}>{relDay(new Date(next.teeTime), new Date(now)) === 'Today' ? 'TODAY' : DAYS[new Date(next.teeTime).getDay()]}</T>
            <T size={17} weight="bold" style={{ lineHeight: 19 }}>{new Date(next.teeTime).getDate()}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T weight="bold">{TIERS[next.tier].name}</T>
            <T size={12.5} muted>Tee {clock(new Date(next.teeTime))} · {next.usedCredit ? 'pass credit' : 'paid'}</T>
          </View>
          <T size={22} color={c.accent}>›</T>
        </Card>
      ) : (
        <View style={{ backgroundColor: c.accentSoft, borderRadius: 14, padding: 12 }}>
          <T size={13} muted>No upcoming bookings. Tap + Book to add your next round.</T>
        </View>
      )}
    </Screen>
  );
}
