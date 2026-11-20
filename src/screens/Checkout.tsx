import { useState } from 'react';
import { FREE_CANCEL_HOURS, TIERS } from '../data/catalog';
import { money, type Quote } from '../lib/pricing';
import { clock, medDate, relDay } from '../lib/time';
import { DateTile, Sheet } from '../components/ui';
import { useStore } from '../state/store';
import type { Booking, NewBooking, PaymentMethod } from '../api/types';

export default function Checkout({ open, onClose, booking, quote, onDone }: {
  open: boolean; onClose: () => void; booking: NewBooking; quote: Quote; onDone: () => void;
}) {
  const { data, book, go, notify } = useStore();
  const member = data!.member;
  const [method, setMethod] = useState<PaymentMethod>(booking.paymentMethod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);

  const tee = new Date(booking.teeTime);
  const freeUntil = new Date(tee.getTime() - FREE_CANCEL_HOURS * 3600000);
  const t = TIERS[booking.tier];

  const close = () => { onClose(); setDone(null); setError(null); };

  async function pay() {
    setBusy(true); setError(null);
    try {
      const b = await book({ ...booking, paymentMethod: method });
      setDone(b);
      onDone();
      notify(b.paid > 0 ? `Paid ${money(b.paid)}` : 'Booked with a pass credit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment did not go through. Try again or pick another payment method.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Sheet open={open} onClose={close} label="Booking confirmed">
        <div className="done">
          <div className="bigb"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg></div>
          <h2 style={{ fontSize: 24, marginTop: 8 }}>You're booked</h2>
          <p className="mut" style={{ margin: 0 }}>{t.name} · {relDay(tee)} · Tee {clock(tee)}</p>
        </div>
        <div className="rc">
          <div className="row"><span>Charged</span><span>{done.paid > 0 ? money(done.paid) : '$0.00 · pass credit used'}</span></div>
          {done.paymentRef && <div className="row mut"><span>Reference</span><span>{done.paymentRef}</span></div>}
        </div>
        <div className="note">Park, drop your keys{done.keys === 'proshop' ? ' at the pro shop' : ''} and head to the first tee. We'll text you when we start and when your car is ready.</div>
        <button type="button" className="btn primary" onClick={() => { close(); go('bookings'); }}>View my bookings</button>
        <button type="button" className="btn ghost" onClick={() => { close(); go('home'); }}>Back to home</button>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} label="Review and pay">
      <h2 style={{ fontSize: 24, fontWeight: 700 }}>Review &amp; pay</h2>
      <div className="sum">
        <DateTile date={tee} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{t.name}</div>
          <div className="mut" style={{ fontSize: 12.5 }}>
            {medDate(tee)} · Tee {clock(tee)} · {booking.size === 'suv' ? 'SUV / Truck' : 'Car'}
            <br />{booking.stall ? `Stall ${booking.stall.toUpperCase()}` : 'Add your stall when you park'} · {booking.keys === 'proshop' ? 'keys at pro shop' : 'car left unlocked'}
          </div>
        </div>
      </div>

      <div className="rc">
        {quote.lines.map((l) => (
          <div className="row" key={l.label}>
            <span>{l.label}{l.note && <span className="mut"> ({l.note})</span>}</span>
            <span>{l.amount === 0 ? 'Included' : money(l.amount)}</span>
          </div>
        ))}
        <div className="row mut"><span>GST 5%</span><span>{money(quote.gst)}</span></div>
        <div className="row tot"><span>Total</span><span>{money(quote.total)}</span></div>
      </div>

      {quote.total > 0 && (
        <fieldset className="pay">
          <legend className="sr">Payment method</legend>
          {([
            ['club', 'Club member account', `Member #${member.memberNo} · added to your club bill`],
            ['apple', 'Apple Pay', ''],
            ['card', `${member.card.brand} •••• ${member.card.last4}`, `Expires ${member.card.exp}`],
          ] as [PaymentMethod, string, string][]).map(([k, l, s]) => (
            <label key={k}>
              <input type="radio" name="pay" id={'pay-' + k} checked={method === k} onChange={() => setMethod(k)} />
              <span>{l}{s && <small>{s}</small>}</span>
            </label>
          ))}
        </fieldset>
      )}

      {error && <div className="err" role="alert">{error}</div>}
      <button type="button" className="btn primary" disabled={busy} onClick={pay}>
        {busy ? 'Processing…' : quote.total > 0 ? `Pay ${money(quote.total)}` : 'Confirm booking'}
      </button>
      <div className="mut" style={{ fontSize: 12, textAlign: 'center' }}>
        Free cancellation until {clock(freeUntil)} {['Today', 'Tomorrow'].includes(relDay(freeUntil)) ? relDay(freeUntil).toLowerCase() : 'on ' + relDay(freeUntil)} ({FREE_CANCEL_HOURS} hours before tee time).
      </div>
    </Sheet>
  );
}
