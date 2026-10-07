# SVD Fitness OS — Gym Management & Fitness Intelligence Platform

Role-based gym platform: **Super Admin** (`/admin`), **Trainer** (`/trainer`) and **Client** (`/client`).

| Layer | Stack |
|---|---|
| Web | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn-style UI · Framer Motion · Recharts |
| 3D | Three.js · React Three Fiber · Drei (landing preview and exercise viewer) |
| API | Node 20+ · Express 5 · TypeScript · Zod · Pino · Socket.IO |
| Data | MySQL 8 · Prisma 6 |

## Status

Every item in every role's navigation is a working screen backed by the real API — there are no placeholder pages and no invented data.

| Area | What works |
|---|---|
| Access | Role-scoped sign-in (email, or username + role), argon2id, rotating refresh tokens, lockout, RBAC enforced on the server, audit log |
| People | Trainers (capacity, suspend, password reset), clients (profile, status, trainer assignment, private staff notes, QR check-in code) |
| Training | Exercise library, drag-and-drop workout builder (warm-up / main / cardio / cool-down, sets, reps, kg, rest, tempo, supersets, dropsets), templates, assignment, calendar & rescheduling, client session runner (set logging, previous performance, rest timer, skip, RPE), history, personal records |
| 3D | React Three Fiber viewer: uploaded **GLB** models (admin-only upload, magic-byte checked, auth-gated download) or a built-in animated demonstration figure per exercise |
| Nutrition | Food database, diet builder with server-computed macros, templates, assignment (archives the previous plan), client meal logging with daily macro bars, extra meals |
| Body analysis | BMI, **estimated** body fat (US Navy), fat/lean mass, BMR, maintenance; nutrition calculator with trainer overrides clamped to admin-configured ranges; goal recommendation with reasons and Accept / Trainer review |
| Tracking | Measurements, progress charts, private progress photos with comparison, water, sleep, steps & habits, weekly/monthly trainer reviews |
| Attendance | Manual register, QR scan (keyboard-wedge scanner friendly), check-in/out, late / leave, device endpoint for door hardware (`x-device-key`) |
| Communication | Real-time messaging and notifications (Socket.IO with polling fallback), hourly reminder sweep (missed workout, today's workout, membership expiry, payment due) |
| Business | Membership plans, subscriptions, payments ledger, invoices, revenue / retention analytics, trainer performance |
| Reports | Monthly client report as JSON and PDF, with trainer comment |

Not built (and not faked): an online payment gateway — payments are recorded manually and the ledger is gateway-ready; SMS/WhatsApp/push delivery — reminders are in-app only; camera-based QR scanning in the browser.

## Quick start

Prerequisites: Node 20+, npm, Docker (for the dev database).

```bash
npm install                 # installs every workspace and generates the Prisma client
cp .env.example .env        # then set ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET (see the file for the command)
npm run db:up               # MySQL 8 on localhost:3307 (own port, won't clash with another MySQL)
npm run db:migrate          # apply migrations
npm run db:seed             # roles, 13 exercises, 26 foods, 3 membership plans, first Super Admin
npm run db:seed:demo        # OPTIONAL dev-only demo: 2 trainers, 8 clients, 3 weeks of activity (refuses to run in production)
npm run dev                 # API → http://localhost:4000   Web → http://localhost:3100
```

> **Ports:** web `3100`, API `4000`, MySQL `3307`. (3000 is deliberately avoided because it is so commonly in use.)
> For the dev DB the `gym` MySQL user needs permission to create the Prisma *shadow database*:
> `docker exec gym-platform-db mysql -uroot -pgym_root_dev -e "GRANT ALL ON *.* TO 'gym'@'%'; FLUSH PRIVILEGES;"`

### Development logins (after `npm run db:seed:demo`, or `npm run db:dev-logins` on an existing DB)

Sign in on `/auth/login` by choosing a **role** (Client · Trainer · Admin) and entering a username or email.
Values come from `.env` (`SEED_ADMIN_USERNAME/PASSWORD`, `SEED_DEMO_USERNAME/PASSWORD`); in this checkout they are all `9606773589`.

| Role | Login | Password |
|---|---|---|
| Super Admin | username `9606773589` (or `admin@gym.local`) | `9606773589` |
| Trainer | username `9606773589` → Aarav Kapoor · or `meera.trainer@gym.local` | `9606773589` |
| Client | username `9606773589` → Priya Sharma · or `rohan.mehta@gym.local`, `kiran.rao@gym.local` … | `9606773589` |

Usernames are unique **per role**, so one username can exist as admin, trainer and client at once. A username without a role, or the right password under the wrong role, is refused.
These are throw-away *development* credentials: they are weaker than the production password policy (10+ chars with a letter and a number), which still applies to password changes and resets. `db:seed:demo` and `db:dev-logins` refuse to run in production.

There is **no public sign-up**: accounts are created by the gym. **Change the admin password before any real use.**

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + web with hot reload |
| `npm run build` / `npm start` | Production build / run |
| `npm run typecheck` | `tsc --noEmit` across every package |
| `npm test` | API integration tests (Vitest + Supertest, separate `gym_platform_test` database) |
| `npm run db:migrate` / `db:deploy` / `db:reset` | Create / apply / wipe migrations |
| `npm run db:studio` | Prisma Studio |

## Repository layout

```
apps/
  api/        Express API  (config · middleware · routes · services · lib · test)
  web/        Next.js app  (app/{auth,admin,trainer,client} · components · lib)
packages/
  config/     roles, permission matrix, nutrition & attention thresholds (no secrets)
  types/      Zod schemas + response types shared by API and web
  database/   Prisma client singleton
prisma/       schema.prisma · migrations · seed.ts · reference data (exercises, foods)
```

## How security works

* **Passwords** — argon2id. Login takes the same time and returns the same message for unknown email and wrong password (no account enumeration). 8 failures → 15-minute lock.
* **Sessions** — 15-minute JWT access token + 30-day **rotating** refresh token, both `httpOnly`, `SameSite=Lax`. Only a SHA-256 hash of each refresh token is stored. Re-presenting an already-rotated token (outside a 10 s multi-tab grace window) burns the whole token family and is audit-logged.
* **Same-origin API** — the browser only talks to the web origin; `/api/*` is proxied to Express, so cookies are first-party and CORS is never needed.
* **Authorization is enforced on the server.** Every request re-reads the user from the database (suspension/role change applies instantly), then passes role and permission checks. Client-scoped data goes through `assertCanAccessClient` (trainer → only assigned clients, returns 404 not 403 so rosters can't be probed; client → only self). Next.js middleware is only a UX guard.
* **Other** — Zod validation on every body, origin check on state-changing requests (CSRF), Helmet, rate limits, `Cache-Control: no-store` on the API, audit log for sign-ins/security events, strict env validation at boot (refuses to start with weak secrets).
* **Password reset** — single-use, hashed, 30-minute links. Without `SMTP_HOST` set, the email is written to the API log (clearly marked *not delivered*) instead of being sent.

## Realtime

The browser opens a Socket.IO connection straight to the API origin (`NEXT_PUBLIC_SOCKET_URL`, default: same host, port 4000) because WebSockets cannot pass through the Next.js rewrite proxy. The session cookie authenticates the socket. If it cannot connect, screens poll every 20–60 s.

## Design decisions worth knowing

* Prisma pinned to **6.x**, TypeScript **5.9**, Zod **3**, Tailwind **3**, Next **15** — current stable majors with the widest tooling support.
* Calendar logic is **UTC** for now; a per-gym timezone arrives with Settings.
* The **Client Attention** badge (🟢 good · 🟡 monitor · 🔴 needs attention · new) is a pure, unit-tested function (`attention.service.ts`) fed by missed workouts, workout/diet compliance and inactivity. 
* Rates (workout completion, diet compliance) return `null` — shown as "—", "No data yet" — when there is nothing to measure, never `0%`.
* The landing page shows no testimonials: there are no real ones yet and inventing them would mislead. Illustrative product mock-ups are labelled *Illustrative example*.
* Body-fat numbers are always labelled **estimated**, and nutrition output is coaching guidance, not medical advice.
