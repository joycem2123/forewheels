import { useMemo, useState } from 'react';
import { ADDONS, AddonId, PLANS, TEE_TIMES, TIERS, TIER_ORDER, TierId, VehicleSize } from '../data/catalog';
import { addonAllowed, hasCredit, money, quote } from '../lib/pricing';
import { atSlot, dayShort, slotLabel } from '../lib/time';
import { Segmented, TierMark } from '../components/ui';
import { useStore } from '../state/store';
import Checkout from './Checkout';
import type { KeyHandoff } from '../api/types';

/** Stand-in for live availability: a few slots each day show as full. */
function isFull(day: Date, slot: string): boolean {
  const n = day.getDate() * 31 + Number(slot.replace(':', ''));
  return n % 7 === 0;
}

export default function Book() {
  const { data, now } = useStore();
  const member = data!.member;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i); return d;
  }), [today.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const [size, setSize] = useState<VehicleSize>(member.vehicle.size);
  const [tier, setTier] = useState<TierId>('signature');
  const [dayIdx, setDayIdx] = useState(1);
  const [slot, setSlot] = useState<string | null>('08:00');
  const [addons, setAddons] = useState<AddonId[]>([]);
  const [stall, setStall] = useState('');
  const [keys, setKeys] = useState<KeyHandoff>('proshop');
  const [review, setReview] = useState(false);

  const day = days[dayIdx];
  const slotOk = (s: string) => atSlot(day, s).getTime() > now + 30 * 60000 && !isFull(day, s);
  const chosen = slot && slotOk(slot) ? slot : null;
  const cleanAddons = addons.filter((a) => addonAllowed(a, tier));
  const q = quote({ tier, size, addons: cleanAddons, plan: member.plan, credits: member.credits });
  const p = PLANS[member.plan];

  const toggleAddon = (id: AddonId) => setAddons((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <main className="screen with-paybar">
      <h1 className="title">Book a detail</h1>
      <Segmented label="Vehicle size" value={size} onChange={setSize} options={[['car', 'Car'], ['suv', 'SUV / Truck']]} />

      <div className="h">Choose a service</div>
      {TIER_ORDER.map((id) => {
        const t = TIERS[id];
        const credit = member.plan !== 'payg' && hasCredit(member.credits, id);
        const disc = !credit && p.discountTiers.includes(id) ? p.discount : 0;
        const sel = tier === id;
        return (
          <button key={id} type="button" className="tier" aria-pressed={sel} onClick={() => setTier(id)}>
            <TierMark tier={id} />
            <div>
              <h3>{t.name}</h3>
              <div className="sub">{t.minutes < 60 ? `${t.minutes} min` : `${t.minutes / 60} hr`} · {t.includes.slice(id === 'express' ? 0 : 1, id === 'express' ? 2 : 3).join(', ').toLowerCase()}</div>
            </div>
            {credit ? <span className="inc">Included</span> : (
              <span className="p">{money(t.price[size] * (1 - disc)).replace('.00', '')}</span>
            )}
            {sel && (
              <ul className="more">
                {t.includes.map((x) => <li key={x}>{x}</li>)}
                {t.note && <li>{t.note}</li>}
              </ul>
            )}
          </button>
        );
      })}

      <div className="h">Tee day</div>
      <div className="dayrow" role="group" aria-label="Tee day">
        {days.map((d, i) => (
          <button key={i} type="button" aria-pressed={i === dayIdx} onClick={() => setDayIdx(i)}>
            {i === 0 ? 'Today' : dayShort(d)}<b>{d.getDate()}</b>
          </button>
        ))}
      </div>

      <div className="h">Tee time</div>
      <div className="tt" role="group" aria-label="Tee time">
        {TEE_TIMES.map((s) => (
          <button key={s} type="button" disabled={!slotOk(s)} aria-pressed={chosen === s} onClick={() => setSlot(s)}
            aria-label={`${slotLabel(s)}${!slotOk(s) ? ', unavailable' : ''}`}>
            {slotLabel(s)}
          </button>
        ))}
      </div>
      {tier === 'pro' && <div className="note">Pro Detail takes about 3.5 hours. Book it for an 18-hole round.</div>}

      <div className="h">Extras{p.discount ? ` · ${Math.round(p.discount * 100)}% off with your pass` : ''}</div>
      <div className="chips" role="group" aria-label="Extras">
        {ADDONS.map((a) => (
          <button key={a.id} type="button" disabled={!addonAllowed(a.id, tier)} aria-pressed={cleanAddons.includes(a.id)} onClick={() => toggleAddon(a.id)}>
            {a.name} · ${a.price}
          </button>
        ))}
      </div>

      <label className="field" htmlFor="stall">Parking stall (optional)
        <input id="stall" className="input" placeholder="e.g. B-14, or add it when you park" value={stall} maxLength={8} onChange={(e) => setStall(e.target.value)} />
      </label>
      <div className="h">Keys</div>
      <Segmented label="Key handoff" value={keys} onChange={setKeys} options={[['proshop', 'Pro shop key drop'], ['unlocked', 'Leave car unlocked']]} />

      <div className="paybar">
        <div>
          <div className="lbl">{q.usesCredit && q.total === 0 ? 'Pass credit' : 'Total incl. GST'}</div>
          <div className="amt">{money(q.total)}</div>
        </div>
        <button type="button" disabled={!chosen} onClick={() => setReview(true)}>{chosen ? 'Review' : 'Pick a time'}</button>
      </div>

      {chosen && (
        <Checkout
          open={review}
          onClose={() => setReview(false)}
          booking={{ tier, size, teeTime: atSlot(day, chosen).toISOString(), stall, keys, addons: cleanAddons, paymentMethod: member.defaultPayment }}
          quote={q}
          onDone={() => { setAddons([]); setStall(''); }}
        />
      )}
    </main>
  );
}
