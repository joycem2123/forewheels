import { useState } from 'react';
import { PLANS, PLAN_ORDER, PlanId, TIERS, VehicleSize } from '@forewheels/engine';
import { dollars, money } from '@forewheels/engine';
import { Segmented } from '../components/ui';
import { useStore } from '../state/store';

export default function Passes() {
  const { data, changePlan, notify } = useStore();
  const member = data!.member;
  const [size, setSize] = useState<VehicleSize>(member.vehicle.size);
  const [confirm, setConfirm] = useState<PlanId | null>(null);
  const [busy, setBusy] = useState(false);

  async function doSwitch(id: PlanId) {
    setBusy(true);
    try {
      await changePlan(id);
      setConfirm(null);
      notify(id === 'payg' ? "Pass ended. You'll pay per service." : `You're on the ${PLANS[id].name}.`);
    } finally { setBusy(false); }
  }

  return (
    <main className="screen">
      <h1 className="title">Passes</h1>
      <Segmented label="Vehicle size" value={size} onChange={setSize} options={[['car', 'Car'], ['suv', 'SUV / Truck']]} />

      {PLAN_ORDER.map((id) => {
        const p = PLANS[id];
        const cur = member.plan === id;
        const price = p.price[size];
        const value = p.retailValue?.[size];
        return (
          <section key={id} className={'plan' + (cur ? ' cur' : '') + (id === 'season' ? ' season' : '')} aria-label={p.name}>
            {id === 'season' && <><span className="bb" style={{ width: 130, height: 130, right: -40, top: -40 }} /><span className="bb" style={{ width: 50, height: 50, right: 60, top: 50 }} /></>}
            <div className="row">
              <h3>{p.name}</h3>
              {cur ? <span className={id === 'season' ? 'save' : 'pill ink'}>Current</span>
                : value ? <span className={id === 'season' ? 'save' : 'pill'}>Save {Math.round((1 - price / value) * 100)}%</span>
                : <span className="mut" style={{ fontSize: 12.5 }}>No commitment</span>}
            </div>
            {id === 'payg'
              ? <div className="price">{dollars(TIERS.express.price[size])}<small> and up, per service</small></div>
              : <div className="price">{dollars(price)}<small> / {p.period}</small></div>}
            {value && <div className="mut" style={{ fontSize: 12.5 }}>{dollars(value)} of services if you use them all</div>}
            <ul>{p.includes.map((x) => <li key={x}>{x}</li>)}</ul>

            {!cur && (confirm === id ? (
              <div className="confirm">
                <span>{id === 'payg'
                  ? 'End your pass? Credits you have left stay valid until it renews.'
                  : `Switch to the ${p.name} for ${money(price)} plus GST? It's charged to your ${member.defaultPayment === 'club' ? 'club account' : 'saved payment method'} today.`}</span>
                <div className="btns">
                  <button type="button" className="sbtn" onClick={() => setConfirm(null)}>Not now</button>
                  <button type="button" className="sbtn" style={{ background: 'var(--ac)', color: '#fff', borderColor: 'var(--ac)' }} disabled={busy} onClick={() => doSwitch(id)}>
                    {busy ? 'Working…' : id === 'payg' ? 'End pass' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="cta" onClick={() => setConfirm(id)}>
                {id === 'payg' ? 'Switch to pay as you go' : `Switch to ${p.name}`}
              </button>
            ))}
          </section>
        );
      })}
      <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>Prices before 5% GST. Season Pass runs May 1 to October 15.</p>
    </main>
  );
}
