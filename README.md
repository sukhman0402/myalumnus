# My Alumnus

Campus-gate visitor verification for universities: a **guard console** (gate iPad) and an **admin console** (desk), sharing one database. Alumni don't use an app; they're records the guard looks up.

> Status: **build slice 0 (foundation)** of the route to private live. Sample data only: "Sample University" is fictional and no real person's data is stored.

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
- Held-case decisions go through `decide_case()`: the **first decision wins**, and deny needs a reason.
- `audit_events` is written by triggers only and cannot be edited or deleted through the API.

## Run locally
1. `npm install`
2. Copy `env.example` to `.env.local` and fill in the project URL and publishable key.
3. `npm run dev`, then open http://localhost:3000

## Database
- Migrations are in `supabase/migrations` and were applied to the project in order (0001 → 0004).
- `supabase/pending` holds changes not yet applied, each with the reason.

## Project records
Decisions and research live in the My Alumnus project docs: planning/00 (roadmap), planning/01 (product concept and decision log), planning/02 (technical plan).
