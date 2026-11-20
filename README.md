# Fore Wheels Detailing

Car detailing while members golf. Members book a detail for their tee time, pay, track progress live and manage their pass.

Same setup as Clutch Up: one repository with a shared, tested `engine` and an Expo / React Native iPhone app.

| Folder | What it is |
|---|---|
| `engine/` | **All prices and business rules**, as plain TypeScript with tests. Both apps use it. |
| `app/` | **The iPhone app.** Expo SDK 58, Expo Router, React Native, TypeScript, Zustand (saved on the phone). Built and released with EAS. |
| `web/` | The earlier mobile web app (Vite + React). Uses the same engine. |

## Run it

```bash
npm install
npm test          # engine tests: pricing, cancellations, booking flow
npm run app       # start the iPhone app (Expo dev server)
npm run web       # start the web app
```

With `npm run app`, scan the QR code with the iPhone camera to open the app in **Expo Go**. Everything in the app runs in Expo Go; no Mac or Xcode is needed.

## Change prices or rules

Edit `engine/src/catalog.ts`. Both apps pick up the change.

| File | What it holds |
|---|---|
| `engine/src/catalog.ts` | Services, add-ons, passes, GST, cancellation window, tee times |
| `engine/src/pricing.ts` | Quotes (pass credits, discounts, GST) and cancellation terms |
| `engine/src/backend.ts` | Booking, cancelling and plan changes on the member's data, plus sample data |
| `engine/src/time.ts` | Dates, tee-time labels and live progress |

## Business rules built in

- Express Wash $59 / $69, Signature Detail $149 / $169, Pro Detail $259 / $289 (car / SUV-truck), plus 5% GST.
- Monthly Pass $229 / $259: 4 Express + 1 Signature a month, 10% off Pro and extras.
- Season Pass $1,195 / $1,345: opening Pro Detail, 5 Signature, 20 Express, 15% off.
- Free cancellation up to 2 hours before tee time. Later: a $20 fee, or the pass credit is used. No cancelling once work has started.

## iPhone app (`app/`)

| Path | What it holds |
|---|---|
| `src/app/(tabs)/` | Home, Bookings, Book, Passes, Me (the tab bar has a "+ Book" button in the middle) |
| `src/app/checkout.tsx` | Review & pay, shown as an iOS sheet |
| `src/store/store.ts` | The member's data, saved on the phone, using the engine's rules |
| `src/lib/payments.ts` | Stand-in payment processor |
| `src/theme.ts` | Colours (always light, like Clutch Up) and Instrument Sans |

### Release to TestFlight (EAS)

Everything is set up, so a new TestFlight build is one command from `app/`:

```bash
npx eas-cli@latest build --platform ios --profile testflight --auto-submit
```

The build number goes up automatically. Apple processes the upload in 5–30 minutes, then it appears in TestFlight.

| Setting | Value |
|---|---|
| Expo project | `@joycem2123/forewheels` |
| Bundle ID | `com.forewheelsdetailing.app` |
| App Store Connect app ID | `6837474613` (in `eas.json`) |
| Apple team | `NVKSSW8ZV6` (Individual), shared with Clutch Up |
| Signing | Shared team distribution certificate plus a Fore Wheels provisioning profile, both stored on Expo |
| Uploads | Use the App Store Connect API key stored on Expo ("Clutch Up EAS Admin") |

## Accounts (Supabase)

Project `ugkdzuanjmbqenbzrelg` in the **Fore Wheels Detailing** organization (free plan; upgrade to Pro before launch so it never pauses). Database setup is in `supabase/migrations/`, the account-deletion service in `supabase/functions/delete-account/`.

- Sign up with email + password (Clutch Up's password rules) and a unique username; sign in with email or username; Sign in with Apple; guests look around.
- Email confirmation is **off** until Fore Wheels has its own email domain and sender (password-reset and email-change emails need it too).
- Deleting an account doesn't yet disconnect Sign in with Apple (needs an Apple sign-in key as a function secret); the app explains how to do it in iPhone Settings.

## Before launch (not built yet)

1. **Email domain and sender** for confirmation and password-reset emails.
2. **Payments.** Stripe for cards and Apple Pay, plus the club's member billing. Detailing is a real-world service, so Apple doesn't allow it to be sold through in-app purchase (RevenueCat / StoreKit).
3. **Staff screen.** For detailers to check cars in, update progress and mark them ready. Today progress is estimated from check-in time.
4. **Notifications.** Push notifications (expo-notifications) when work starts and when the car is ready, and a Live Activity on the lock screen showing progress (expo-widgets, as Clutch Up does).
5. **Real availability.** Today a few tee-time slots show as full at random.
