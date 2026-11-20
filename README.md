# Fore Wheels Detailing

Mobile web app for car detailing while members golf. Members book a detail for their tee time, pay, track progress live and manage their pass. It installs to the phone's home screen ("Add to Home Screen") and works like an app.

## Run it

```bash
npm install
npm run dev       # local dev server
npm test          # pricing and cancellation rules
npm run build     # production build in dist/
```

`npm run build:single` makes a one-file build in `dist-single/` for sharing a preview.

## What's where

| Path | What it holds |
|---|---|
| `src/data/catalog.ts` | **All prices and rules.** Services, add-ons, passes, GST, cancellation window, tee times. Change prices here. |
| `src/lib/pricing.ts` | Quotes (pass credits, discounts, GST) and cancellation terms. Tested in `pricing.test.ts`. |
| `src/api/client.ts` | Stand-in backend. Stores data in the browser and returns sample data on first launch. |
| `src/api/payments.ts` | Stand-in payment processor. |
| `src/state/store.tsx` | App state, navigation and live progress refresh. |
| `src/screens/` | Home, Book, Checkout, Bookings, Passes, Me. |
| `src/styles.css` | Colours, type and layout. Light by default with a dark theme. |
| `public/` | Home-screen icon, manifest and offline support. |

## Business rules built in

- Express Wash $59 / $69, Signature Detail $149 / $169, Pro Detail $259 / $289 (car / SUV-truck), plus 5% GST.
- Monthly Pass $229 / $259: 4 Express + 1 Signature a month, 10% off Pro and extras.
- Season Pass $1,195 / $1,345: opening Pro Detail, 5 Signature, 20 Express, 15% off.
- Free cancellation up to 2 hours before tee time. Later: a $20 fee, or the pass credit is used. No cancelling once work has started.

## Before launch (not built yet)

1. **Real backend and accounts.** Replace `src/api/client.ts` with calls to a server and database (for example Supabase or Firebase), with member sign-in.
2. **Real payments.** Replace `src/api/payments.ts` with Stripe (cards and Apple Pay) and the club's member billing for "charge to member account".
3. **Staff view.** A screen for detailers to check cars in, update progress and mark them ready. Today progress is simulated from check-in time.
4. **Text messages.** Notifications when work starts and when the car is ready (for example Twilio).
5. **Real availability.** Today a few tee-time slots show as full at random. Replace with real capacity per detailer.
6. **Hosting.** Deploy `dist/` to a host such as Vercel or Netlify on your own domain.
