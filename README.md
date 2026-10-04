# My Alumnus

Campus-gate visitor verification for universities: a **guard console** (gate iPad) and an **admin console** (desk), sharing one database. Alumni don't use an app; they're records the guard looks up.

> Status: **feature-complete (build slices 1–5)**.
> - Gate: search, record, Approve, Deny, Flag & Hold, Inside now with exits and overstay, Expected today, student-family visits, and offline search with sync.
> - Admin: escalation queue with phone and computer alerts (web push), Alumni records with photos and bulk upload, Visitors, History with CSV export, Security users, Campus rules, and the weekly Reports.
> - Sample data only: "Sample University" is fictional and no real person's data is stored.

## Stack (planning/02)
- **Next.js 16** (App Router, TypeScript), styled only with the My Alumnus design system (`src/styles`: tokens v1.15, components, screens).
- **Supabase** in Mumbai (`ap-south-1`): Postgres with row-level security, Auth (email one-time codes), Storage, Realtime.
- **Vercel** hosting, server functions pinned to Mumbai (`bom1`).

## How access works
| Who | Signs in? | Can |
|---|---|---|
| Admin | Email + 6-digit code | Everything in their own university |
| Gate device (e.g. "Gate 2 iPad") | Email + code, once, by an admin | Entries at its own gate |
| Guard | No: taps their name on the gate device at shift start | Recorded on every entry of that shift |

- Every table carries `university_id`, and every query passes through row-level security. A guard or admin can never read another university's rows, even if the app has a bug.
- Gate entries go through `gate_decide()` only (no direct inserts): it records the **guard on shift**, refuses Approve outside visiting hours or while the person is already inside, needs a reason to deny, and records a retried request once (`client_id`).
- Held-case decisions go through `decide_case()`: the **first decision wins**, and deny needs a reason.
- `audit_events` is written by triggers only and cannot be edited or deleted through the API. Record, account and rule pages show it as "Changes".
- Admins change records, accounts, expected visitors and rules only through `admin_*()` functions (migration 0011), which check the role, the university and the data. Direct table writes are revoked.
- Photos sit in a private Storage bucket (`photos/<university id>/…`, JPEG, 480 × 640, cropped in the browser). Admins manage them; a gate device can only sign links to current photos of active records.

## Run locally
1. `npm install`
2. Copy `env.example` to `.env.local` and fill in the project URL and publishable key. For admin alerts, also add a VAPID key pair (`npx web-push generate-vapid-keys`); without it the app works and simply hides the alerts panel.
3. `npm run dev`, then open http://localhost:3000

## Database
- Migrations are in `supabase/migrations` and were applied to the project in order (0001 → 0004, then 0006 → 0014). 0005 is still in `supabase/pending`.
- Two scheduled jobs run in the database (pg_cron): `ma-case-handoff` every minute (held cases pass to the host after the campus's escalation minutes) and `ma-sample-expected` daily at 00:05 IST (sample expected visitors for the fictional university only; remove before real data).
- Consoles refresh themselves every 5–10 seconds while open. Admins can also turn on **alerts** (web push, planning/02 Q2) on the dashboard: a held visitor triggers a notification with no names in it. On iPad or iPhone this needs the Home Screen app (Share › Add to Home Screen; `src/app/manifest.ts`, `public/sw.js`).
- **Offline at the gate** (planning/02 D11): the iPad keeps a minimal list (name, type, programme, batch; no photos or phone numbers) in IndexedDB, refreshed hourly and per guard. With no internet, search uses it; decisions are saved on the iPad and recorded by `gate_decide_offline()` when the network returns (checked as of the moment they were made, at most 4 hours old, marked "Recorded offline" in History). The list is cleared when the sign-in page opens.
- `supabase/pending` holds changes not yet applied, each with the reason.

## Languages and sample photos
- The guard console is in English and Hindi (`src/lib/i18n.ts`); the Hindi still needs a native review.
- The fictional people use drawn SAMPLE faces in `public/sample-photos`. Real photos live in the private `photos` bucket and are shown through links that expire after 5 minutes (`src/lib/photos.ts`).

## Project records
Decisions and research live in the My Alumnus project docs: planning/00 (roadmap), planning/01 (product concept and decision log), planning/02 (technical plan).
