import { cancelTerms, quote } from './pricing';
import { PLANS } from './catalog';

describe('quote', () => {
  it('charges list price plus GST on pay as you go', () => {
    const q = quote({ tier: 'signature', size: 'car', addons: [], plan: 'payg', credits: {} });
    expect(q.subtotal).toBe(149);
    expect(q.gst).toBe(7.45);
    expect(q.total).toBe(156.45);
  });

  it('uses a pass credit and discounts add-ons', () => {
    const q = quote({ tier: 'express', size: 'suv', addons: ['pet'], plan: 'monthly', credits: PLANS.monthly.credits });
    expect(q.usesCredit).toBe(true);
    expect(q.subtotal).toBe(31.5); // 35 less 10%
  });

  it('charges when credits are used up, with Pro discount on monthly', () => {
    const q = quote({ tier: 'pro', size: 'car', addons: [], plan: 'monthly', credits: PLANS.monthly.credits });
    expect(q.usesCredit).toBe(false);
    expect(q.subtotal).toBe(233.1);
  });

  it('drops add-ons that do not apply to the tier', () => {
    const q = quote({ tier: 'express', size: 'car', addons: ['ceramic'], plan: 'payg', credits: {} });
    expect(q.lines).toHaveLength(1);
  });
});

describe('cancelTerms', () => {
  const now = new Date('2026-06-05T08:00:00');
  it('is free more than 2 hours out', () => {
    const t = cancelTerms({ teeTime: '2026-06-05T11:00:00', status: 'booked', paid: 100, usedCredit: false }, now);
    expect(t).toEqual({ kind: 'free', refund: 100, returnsCredit: false });
  });
  it('keeps a $20 fee inside 2 hours', () => {
    const t = cancelTerms({ teeTime: '2026-06-05T09:00:00', status: 'booked', paid: 100, usedCredit: false }, now);
    expect(t).toEqual({ kind: 'late', fee: 20, refund: 80, returnsCredit: false });
  });
  it('is closed once work has started', () => {
    expect(cancelTerms({ teeTime: '2026-06-05T09:00:00', status: 'in_progress', paid: 0, usedCredit: true }, now).kind).toBe('closed');
  });
});
