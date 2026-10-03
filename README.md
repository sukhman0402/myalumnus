# My Alumnus

Campus-gate visitor verification for universities: a **guard console** (gate iPad) and an **admin console** (desk), sharing one database. Alumni don't use an app; they're records the guard looks up.

> Status: **build slices 1–3** of the route to private live: the gate (search, record, Approve, Deny), Flag & Hold escalation with the admin queue, Inside now with exits and overstay, Expected today and student-family visits. Admin record management, reports and offline arrive in slices 4–5. Sample data only: "Sample University" is fictional and no real person's data is stored.

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
- `audit_events` is written by triggers only and cannot be edited or deleted through the API.

## Run locally
1. `npm install`
2. Copy `env.example` to `.env.local` and fill in the project URL and publishable key.
3. `npm run dev`, then open http://localhost:3000

## Database
- Migrations are in `supabase/migrations` and were applied to the project in order (0001 → 0004, then 0006 → 0010). 0005 is still in `supabase/pending`.
- Two scheduled jobs run in the database (pg_cron): `ma-case-handoff` every minute (held cases pass to the host after the campus's escalation minutes) and `ma-sample-expected` daily at 00:05 IST (sample expected visitors for the fictional university only; remove before real data).
- Consoles refresh themselves every 5–10 seconds while open; web push (planning/02 Q2) is still to come.
- `supabase/pending` holds changes not yet applied, each with the reason.

## Languages and sample photos
- The guard console is in English and Hindi (`src/lib/i18n.ts`); the Hindi still needs a native review.
- The fictional people use drawn SAMPLE faces in `public/sample-photos`. Real photos will live in a private Storage bucket, shown through links that expire (slice 4).

## Project records
Decisions and research live in the My Alumnus project docs: planning/00 (roadmap), planning/01 (product concept and decision log), planning/02 (technical plan).
