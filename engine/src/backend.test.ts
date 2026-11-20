import { addBooking, advance, cancelBooking, seed, switchPlan } from './backend';

const NOW = new Date('2026-06-05T10:00:00').getTime();

describe('booking flow', () => {
  it('uses a pass credit for a covered booking', () => {
    const d = seed(NOW);
    const { data, booking } = addBooking(d, {
      tier: 'express', size: 'suv', teeTime: new Date('2026-06-06T08:00:00').toISOString(),
      stall: 'b-3', keys: 'proshop', addons: [], paymentMethod: 'club',
    }, null, NOW);
    expect(booking.usedCredit).toBe(true);
    expect(booking.stall).toBe('B-3');
    expect(data.member.credits.express!.used).toBe(d.member.credits.express!.used + 1);
    expect(d.bookings).toHaveLength(4); // original untouched
  });

  it('returns the credit on a free cancellation', () => {
    const d = seed(NOW);
    const before = d.member.credits.express!.used;
    const r = cancelBooking(d, 'b-1002', NOW);
    expect(r.data.member.credits.express!.used).toBe(before - 1);
    expect(r.data.bookings.find((b) => b.id === 'b-1002')!.status).toBe('cancelled');
  });

  it('will not cancel a job that has started', () => {
    expect(() => cancelBooking(seed(NOW), 'b-1001', NOW)).toThrow();
  });

  it('marks a job ready when its time is up', () => {
    const d = seed(NOW);
    expect(advance(d, NOW)).toBe(d);
    const later = advance(d, NOW + 3 * 3600000);
    expect(later.bookings.find((b) => b.id === 'b-1001')!.status).toBe('ready');
  });

  it('resets credits when switching plans', () => {
    const d = switchPlan(seed(NOW), 'season');
    expect(d.member.credits.express).toEqual({ used: 0, of: 20 });
  });
});
