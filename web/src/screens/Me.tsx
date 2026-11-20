import { PLANS } from '@forewheels/engine';
import { monthDay } from '@forewheels/engine';
import { Segmented } from '../components/ui';
import { useStore } from '../state/store';
import type { Member, PaymentMethod } from '@forewheels/engine';

export default function Me() {
  const { data, updateMember, reset, go } = useStore();
  const m = data!.member;
  const set = (patch: Partial<Member>) => updateMember(patch);
  const payLabel: Record<PaymentMethod, string> = { club: 'Club member account', apple: 'Apple Pay', card: m.card ? `${m.card.brand} •••• ${m.card.last4}` : 'Card' };

  return (
    <main className="screen">
      <h1 className="title">{m.firstName}</h1>
      <div className="mut" style={{ marginTop: -10 }}>{m.club} · Member #{m.memberNo}</div>

      <div className="h">Vehicle</div>
      <div className="group">
        <div className="item"><span>{m.vehicle.label}</span><span className="v">{m.vehicle.plate}</span></div>
        <div className="item" style={{ display: 'block' }}>
          <Segmented label="Vehicle size" value={m.vehicle.size} onChange={(size) => set({ vehicle: { ...m.vehicle, size } })} options={[['car', 'Car'], ['suv', 'SUV / Truck']]} />
        </div>
      </div>

      <div className="h">Pass</div>
      <div className="group">
        <div className="item"><span>{PLANS[m.plan].name}</span>
          <button type="button" className="link" onClick={() => go('passes')}>Change</button></div>
        {m.plan !== 'payg' && <div className="item"><span>Renews</span><span className="v">{monthDay(new Date(m.planRenews))}</span></div>}
      </div>

      <div className="h">Default payment</div>
      <div className="group">
        {(['club', 'apple', 'card'] as PaymentMethod[]).map((k) => (
          <label key={k} className="item" htmlFor={'def-' + k} style={{ cursor: 'pointer' }}>
            <span>{payLabel[k]}</span>
            <input type="radio" id={'def-' + k} name="defpay" checked={m.defaultPayment === k} onChange={() => set({ defaultPayment: k })} style={{ accentColor: 'var(--ac)', width: 20, height: 20 }} />
          </label>
        ))}
      </div>

      <div className="h">Text me when</div>
      <div className="group">
        {([['started', 'Work starts on my car'], ['ready', 'My car is ready'], ['reminders', 'I have a tee time with no booking']] as [keyof Member['notify'], string][]).map(([k, l]) => (
          <label key={k} className="item" htmlFor={'n-' + k}>
            <span>{l}</span>
            <input type="checkbox" role="switch" className="switch" id={'n-' + k} checked={m.notify[k]} onChange={(e) => set({ notify: { ...m.notify, [k]: e.target.checked } })} />
          </label>
        ))}
      </div>

      <div className="h">Help</div>
      <div className="group">
        <div className="item"><span>Cancellations</span><span className="v">Free up to 2 hrs before tee time</span></div>
        <div className="item"><span>Questions</span><span className="v">Ask at the pro shop</span></div>
        <div className="item"><span>Sample data</span><button type="button" className="link" onClick={reset}>Restore</button></div>
      </div>
    </main>
  );
}
