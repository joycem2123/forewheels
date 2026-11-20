import { useState } from 'react';
import { TIERS } from '@forewheels/engine';
import { cancelTerms, money } from '@forewheels/engine';
import { clock, medDate, progress, relDay, shortClock } from '@forewheels/engine';
import { Bubbles, DateTile, Segmented } from '../components/ui';
import { useStore } from '../state/store';
import type { Booking } from '@forewheels/engine';

export default function Bookings() {
  const { data, now, cancel, go } = useStore();
  const [view, setView] = useState<'up' | 'past'>('up');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  const upcoming = data.bookings.filter((b) => ['booked', 'in_progress', 'ready'].includes(b.status))
    .sort((a, b) => a.teeTime.localeCompare(b.teeTime));
  const past = data.bookings.filter((b) => ['completed', 'cancelled'].includes(b.status))
    .sort((a, b) => b.teeTime.localeCompare(a.teeTime));

  async function doCancel(id: string) {
    setBusy(true);
    try { await cancel(id); setConfirming(null); } finally { setBusy(false); }
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
    <main className="screen">
      <h1 className="title">Bookings</h1>
      <Segmented label="Show" value={view} onChange={setView} options={[['up', `Upcoming (${upcoming.length})`], ['past', 'Past']]} />

      {view === 'up' && (upcoming.length === 0 ? (
        <div className="empty">
          <div>No upcoming bookings.</div>
          <button type="button" className="sbtn" onClick={() => go('book')}>Book a detail</button>
        </div>
      ) : upcoming.map((b) => {
        const tee = new Date(b.teeTime);
        const live = b.status === 'in_progress' || b.status === 'ready';
        const p = progress(b, now);
        const isToday = relDay(tee, new Date(now)) === 'Today';
        return (
          <article className="bk" key={b.id}>
            <div className="top">
              <DateTile date={tee} accent={live} label={isToday ? 'TODAY' : undefined} />
              <div>
                <div className="row">
                  <b>{TIERS[b.tier].name}</b>
                  {b.status === 'in_progress' && <span className="pill">In progress</span>}
                  {b.status === 'ready' && <span className="pill ok">Ready</span>}
                  {b.status === 'booked' && <span className="pill ghost">Booked</span>}
                </div>
                <div className="mut" style={{ fontSize: 12.5 }}>
                  {live
                    ? `Stall ${b.stall || '—'} · ${b.status === 'ready' ? 'ready for pickup' : `ready about ${p.readyAt ? shortClock(p.readyAt) : ''}`}`
                    : `Tee ${clock(tee)} · ${b.usedCredit ? 'pass credit' : `paid ${money(b.paid)}`}${b.stall ? ` · stall ${b.stall}` : ''}`}
                </div>
              </div>
            </div>
            {live && <Bubbles pct={p.pct} small />}
            {b.status === 'booked' && (confirming === b.id ? (
              <div className="cx">
                <b>Cancel {relDay(tee, new Date(now)) === 'Today' ? "today's" : `${medDate(tee).split(',')[0]}'s`} {TIERS[b.tier].name}?</b>
                <span className="mut">{terms(b)}</span>
                <div className="btns">
                  <button type="button" className="sbtn" onClick={() => setConfirming(null)}>Keep it</button>
                  <button type="button" className="sbtn fill-danger" disabled={busy} onClick={() => doCancel(b.id)}>{busy ? 'Cancelling…' : 'Cancel booking'}</button>
                </div>
              </div>
            ) : (
              <div className="actions">
                <button type="button" className="sbtn danger" onClick={() => setConfirming(b.id)}>Cancel</button>
              </div>
            ))}
            {live && <div className="mut" style={{ fontSize: 12 }}>Work has started, so this booking can't be cancelled.</div>}
          </article>
        );
      }))}

      {view === 'past' && (past.length === 0 ? <div className="empty">No past bookings yet.</div> : (
        <div>
          {past.map((b) => (
            <div className="past" key={b.id}>
              <span>
                <b>{TIERS[b.tier].name}</b><br />
                <span className="mut">{medDate(new Date(b.teeTime))} · {b.status === 'cancelled'
                  ? (b.refund ? `cancelled, ${money(b.refund)} refunded` : 'cancelled')
                  : b.usedCredit ? 'pass credit' : b.paymentMethod === 'club' ? 'club account' : b.paymentMethod === 'apple' ? 'Apple Pay' : 'card'}</span>
              </span>
              <b className="tn">{b.status === 'cancelled' ? money(Math.max(0, b.paid - (b.refund ?? 0))) : money(b.paid)}</b>
            </div>
          ))}
        </div>
      ))}
    </main>
  );
}
