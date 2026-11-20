import type { PaymentMethod } from '@forewheels/engine';

// Stand-in payment processor. Replace with a server call that creates a Stripe
// PaymentIntent (cards and Apple Pay through Stripe's React Native SDK) or posts a
// charge to the club's member billing.
//
// Car detailing is a real-world service, so Apple's rules say it must NOT be sold
// through in-app purchase (RevenueCat / StoreKit). Use Stripe or the club account.
export async function charge(amount: number, method: PaymentMethod): Promise<{ ref: string }> {
  await new Promise((r) => setTimeout(r, 700));
  if (amount < 0) throw new Error('Amount must be positive');
  const prefix = method === 'club' ? 'CLUB' : method === 'apple' ? 'APPL' : 'CARD';
  return { ref: `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
}

export async function refund(ref: string | null, amount: number): Promise<void> {
  if (!ref || amount <= 0) return;
  await new Promise((r) => setTimeout(r, 400));
}
