import { PLANS, TIERS } from '../data/catalog';
import { clock, monthDay, progress, relDay, shortClock } from '../lib/time';
import { Bubbles, Donut, Logo } from '../components/ui';
import { useStore } from '../state/store';

export default function Home() {
  const { data, now, go } = useStore();
  if (!data) return null;
  const { member, bookings } = data;
  const plan = PLANS[member.plan];

  const live = bookings.find((b) => b.status === 'in_progress' || b.status === 'ready');
  const next = bookings
    .filter((b) => b.status === 'booked')
    .sort((a, b) => a.teeTime.localeCompare(b.teeTime))[0];
  const p = live ? progress(live, now) : null;
  const ex = member.credits.express;
  const sig = member.credits.signature;

  return (
    <main className="screen">
      <div className="row"><Logo /><span className="pill">{plan.name}</span></div>

      <h1 className="hi">
        Hey {member.firstName}, {live ? 'enjoy the round.' : 'ready for your next round?'}<br />
        <span>{live ? "We've got the car." : 'We’ll handle the car.'}</span>
      </h1>

      <section className="blob" aria-label="Your car">
        <span className="bb a" /><span className="bb b" /><span className="bb c" />
        {live && p ? (
          live.status === 'ready' ? (
            <>
              <div className="k">Stall {live.stall || '—'} · {TIERS[live.tier].name}</div>
              <h2>Your car is ready</h2>
              <Bubbles pct={1} />
              <div className="ready"><span>All done</span><span>Keys {live.keys === 'proshop' ? 'at the pro shop' : 'in the car'}</span></div>
            </>
          ) : (
            <>
              <div className="k">Stall {live.stall || '—'} · {TIERS[live.tier].name}</div>
              <h2>{p.stage} in progress</h2>
              <Bubbles pct={p.pct} />
              <div className="ready"><span>{Math.round(p.pct * 100)}% done</span><span>Ready about <b>{p.readyAt ? shortClock(p.readyAt) : ''}</b></span></div>
            </>
          )
        ) : (
          <>
            <div className="k">No car in the bay right now</div>
            <h2>Book a detail for your next tee time</h2>
            <Bubbles pct={0} />
            <button type="button" className="btn-w" onClick={() => go('book')}>Book a detail</button>
          </>
        )}
      </section>

      {member.plan !== 'payg' && ex && (
        <button type="button" className="passc" onClick={() => go('passes')}>
          <Donut value={ex.of - ex.used} of={ex.of} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Express Washes left</div>
            <div className="mut" style={{ fontSize: 12.5 }}>
              {ex.of - ex.used} of {ex.of} {member.plan === 'monthly' ? 'this month' : 'this season'}
              {sig ? ` · ${sig.of - sig.used} Signature left` : ''}
            </div>
            <div className="mut" style={{ fontSize: 12 }}>Renews {monthDay(new Date(member.planRenews))}</div>
          </div>
        </button>
      )}

      {next ? (
        <button type="button" className="nx" onClick={() => go('bookings')}>
          <div className="cir">{relDay(new Date(next.teeTime), new Date(now)) === 'Today' ? 'TODAY' : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(next.teeTime).getDay()]}<b>{new Date(next.teeTime).getDate()}</b></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{TIERS[next.tier].name}</div>
            <div className="mut" style={{ fontSize: 12.5 }}>Tee {clock(new Date(next.teeTime))} · {next.usedCredit ? 'pass credit' : 'paid'}</div>
          </div>
          <span style={{ color: 'var(--ac)', fontSize: 22 }} aria-hidden="true">›</span>
        </button>
      ) : (
        <div className="note">No upcoming bookings. Tap <b>+ Book</b> to add your next round.</div>
      )}
    </main>
  );
}
