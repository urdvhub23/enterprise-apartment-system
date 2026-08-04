# Apartment Management System — Architecture

## 1. Overview

A multi-client apartment management platform covering leasing, billing,
maintenance requests, notices, and tenant–staff communication, built around
one API gateway and a polyglot persistence layer.

```
┌───────────────┐   ┌───────────────┐   ┌────────────────────┐
│  React Web    │   │  Staff PWA    │   │  Android (Java)     │
│  (tenants +   │   │ (same React   │   │  native client      │
│  staff admin) │   │  build, PWA)  │   │  for staff on the go│
└───────┬───────┘   └───────┬───────┘   └──────────┬──────────┘
        │                   │                       │
        └─────────────┬─────┴───────────────────────┘
                       │ HTTPS / JSON (+ WebSocket for chat)
                       ▼
            ┌─────────────────────────┐
            │   Node.js / Express      │
            │   API Gateway            │
            │  (auth, rate limiting,   │
            │   routing, sockets)      │
            └────────────┬─────────────┘
                          │
      ┌───────────────────┼────────────────────┐
      │                   │                     │
      ▼                   ▼                     ▼
┌───────────┐     ┌───────────────┐     ┌───────────────┐
│  Auth &    │     │  Billing       │     │ Complaints /  │
│  Property  │     │  service       │     │ Notices /     │
│  service   │     │  (invoices,    │     │ Chat /        │
│  (users,   │     │  payments)     │     │ Notifications │
│  units,    │     │                │     │               │
│  leases)   │     │                │     │               │
└─────┬──────┘     └───────┬────────┘     └───────┬───────┘
      │                    │                       │
      ▼                    ▼                       ▼
┌───────────────────────────────┐     ┌───────────────────────────┐
│         PostgreSQL             │     │          MongoDB           │
│  users, apartments, leases,    │     │  complaints, notices,       │
│  invoices, payments            │     │  chat_messages,             │
│  (ACID, foreign keys,          │     │  notifications               │
│   transactions)                │     │  (flexible schema, high      │
│                                 │     │   write volume)              │
└───────────────────────────────┘     └───────────────────────────┘
```

## 2. Frontend

### Web app (React + Vite) — `/frontend`
- Single React codebase serving **both** tenants and staff; role comes from
  the JWT and drives which nav links/routes render (`AuthContext`,
  `ProtectedRoute`).
- Responsive layout, no heavy component framework — plain CSS with a design
  token system (`src/styles/tokens.css`) so it stays light on low-end
  devices.
- Realtime support chat via Socket.IO client.

### Staff PWA
- The **same** React build, made installable via `vite-plugin-pwa`
  (`vite.config.js`). Generates a manifest + service worker so staff can
  "install" it to a phone home screen and get offline caching for read-heavy
  views (notices, unit list) — without maintaining a second codebase.
- This is the pragmatic reading of "PWA for staff": rather than a third
  separate frontend, the web app *is* the PWA when installed. If a
  visually distinct staff-only shell is wanted later, it can share
  `src/api` and `src/components` and diverge only in `App.jsx`.

### Android app (Java) — `/android`
- Native scaffold: Gradle project, Retrofit-based `ApiService` hitting the
  **same** `/api/*` routes as the web app, `SessionManager` for JWT storage,
  working `LoginActivity` → `DashboardActivity` → `ComplaintsActivity` /
  `BillingActivity` flow.
- Deliberately minimal beyond that — a production Android app (push
  notifications via FCM, offline sync, full Material UI for every screen,
  Play Store release signing) is a substantial standalone project. This
  scaffold is the correct foundation to build that out incrementally, reusing
  the backend contract already defined for the web client.

## 3. Backend — Node.js / Express API Gateway

`/backend` is a **modular monolith structured like microservices**: one
Express process, but each domain lives in its own folder with its own
routes, and only touches the database tables/collections it owns
(`services/auth`, `services/tenants`, `services/billing`,
`services/complaints`, `services/notifications`). This gets you the loose
coupling and clear ownership boundaries of microservices — a spike in
complaint volume doesn't touch billing code — without the operational
overhead of running/deploying/monitoring N separate services on day one.

**Path to true microservices**, when scale justifies it: each `services/*`
folder is already structured to be lifted out as its own deployable
(own `package.json`, own DB connection). The API gateway (`server.js`)
would then become a thin router/proxy (e.g. via `http-proxy-middleware` or
a dedicated gateway like Kong) instead of mounting the routers directly.
Billing is the first candidate to split out, since it has the strictest
uptime/consistency requirements and the most predictable load pattern.

Cross-cutting concerns:
- **Auth**: JWT bearer tokens, `middleware/auth.js` (`authenticate` +
  role-based `authorize(...)`).
- **Rate limiting**: `express-rate-limit` on all `/api/*` routes.
- **Realtime**: Socket.IO for tenant↔staff chat, room-per-thread.
- **Scheduled jobs**: `node-cron` job marks overdue invoices daily.
- **Error handling**: centralized `middleware/errorHandler.js` normalizes
  Sequelize/Mongoose validation errors into one JSON shape.

## 4. Database — Polyglot Persistence

| Data | Store | Why |
|---|---|---|
| Users, roles, auth | PostgreSQL | Strict uniqueness, referential integrity to leases/invoices |
| Apartments/units | PostgreSQL | Structured, low write volume, joined with leases constantly |
| Leases | PostgreSQL | Foreign keys to users + apartments; date-range logic |
| Invoices | PostgreSQL | Financial ledger; needs ACID, numeric precision (`DECIMAL`), auditability |
| Payments | PostgreSQL | Written inside a **DB transaction** with the invoice update (`billing.routes.js`) — a partial write here would corrupt the ledger, which is exactly what Postgres transactions exist to prevent |
| Complaints/tickets | MongoDB | Variable shape per category, embedded comment threads, high read/write skew per tenant |
| Notices | MongoDB | Simple, schema-light, no relational constraints needed |
| Chat messages | MongoDB | High write volume, append-only, no joins |
| Notifications | MongoDB | Very high write volume, TTL-friendly, disposable |

The **billing transaction** in `services/billing/billing.routes.js` is the
clearest illustration of why financial data sits in Postgres: it opens a
`sequelize.transaction()`, locks the invoice row (`LOCK.UPDATE`), writes the
payment, recomputes the invoice status, and commits — or rolls every part of
it back on failure. That guarantee doesn't exist in MongoDB without
significantly more application-level complexity.

## 5. Suggested Deployment Topology

```
                     ┌─────────────┐
                     │   CDN /     │
Internet ──────────▶ │  Load       │
                     │  Balancer   │
                     └──────┬──────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     ┌────────────────┐         ┌──────────────────┐
     │  Static hosting  │        │  API Gateway       │
     │  (React/PWA      │        │  containers         │
     │  build)           │        │  (Node, N replicas, │
     │  Netlify/Vercel/  │        │  behind LB)          │
     │  S3+CloudFront    │        └─────────┬───────────┘
     └────────────────┘                    │
                                ┌────────────┴────────────┐
                                ▼                          ▼
                     ┌─────────────────────┐   ┌──────────────────────┐
                     │  Managed PostgreSQL   │   │  Managed MongoDB       │
                     │  (RDS / Cloud SQL /   │   │  (Atlas / DocumentDB)  │
                     │  Supabase) + read      │   │                        │
                     │  replica for reporting │   │                        │
                     └─────────────────────┘   └──────────────────────┘
```

- **API gateway**: containerize (`Dockerfile`, not yet generated — say the
  word and I'll add one) and run 2+ replicas behind a load balancer; Socket.IO
  needs sticky sessions or a Redis adapter (`socket.io-redis`) once you scale
  past one instance.
- **Secrets**: `JWT_SECRET`, DB credentials, SMTP creds — inject via your
  platform's secret manager, never commit `.env`.
- **Migrations**: `sequelize.sync({ alter: true })` is used in dev for speed;
  swap to `sequelize-cli` migrations before production so schema changes are
  reviewable and reversible.
- **Observability**: add structured logging (e.g. pino) + an APM
  (e.g. OpenTelemetry) before go-live; `morgan` alone is dev-grade.
- **Android release**: signed release build distributed via Play Store
  internal testing track first, pointed at a staging `API_BASE_URL`.

## 6. Extended feature set (residents, gate staff, committees)

Added on top of the original leasing/billing/maintenance core:

| Feature | Where | Notes |
|---|---|---|
| Maintenance dues + receipt upload | `billing.routes.js` | Card/UPI payments complete instantly; bank transfer/cheque with an uploaded receipt go to `pending` until staff verify via `PATCH /billing/payments/:id/verify`. File storage for the receipt itself isn't wired up — `receipt_url` expects a URL from real object storage (S3/GCS), not implemented here. |
| Facility booking, no double-booking | `facilities.routes.js`, `models/FacilityBooking.js` | Enforced twice: an app-level overlap check inside a DB transaction, **and** a Postgres `EXCLUDE` constraint (`scripts/migrate.js`) so a race between two simultaneous requests still can't double-book. |
| Community discussion board, moderated | `community.routes.js` | Staff can flag/remove posts and replies. No profanity/spam auto-filtering — moderation is manual by design; add a filter service if volume demands it. |
| Visitor QR passes | `visitors.routes.js` | Resident generates a time-limited token (max 72h window); staff scan/paste it at `/visitors/lookup/:token` to check in. QR **images** are rendered client-side via a public QR API for this scaffold — swap to a client-side library (`qrcode` npm package) before production so tokens aren't sent to a third party. |
| Gate staff offline-first PWA log | `frontend/src/pages/Visitors.jsx` (GateLog), `POST /visitors/sync-batch` | Entries queue in `localStorage` when `navigator.onLine` is false and auto-sync on the browser's `online` event, using a client-generated idempotency key so a retried sync can't double-log an entry. This is a genuine offline-first pattern, but for true reliability across app restarts/crashes, swap `localStorage` for IndexedDB and register a real Background Sync service worker event — the current version only syncs while the tab is open. |
| Hardware integration (biometric/RFID/QR scanners) | `Visitor.entry_method` field | The data model and check-in endpoint accept an `entry_method` of `qr_scan`/`rfid`/`biometric`/`manual`, so a scanner integration just needs to POST to the existing `/visitors/:id/check-in` endpoint (or extend `/visitors/lookup/:token` for an RFID tag ID instead of a QR token). **No actual hardware SDK/driver integration is included** — that's inherently vendor-specific (each RFID/biometric device has its own SDK) and can't be built generically; this scaffold gives the correct API surface to integrate against once a specific device is chosen. |
| Multi-tenant BI dashboards | `Society` model, `middleware/tenantScope.js`, `analytics.routes.js` | A `super_admin` with no `society_id` is treated as an enterprise admin and sees every society; anyone else is pinned to their own. `/analytics/portfolio` returns billed-vs-collected per society for the "oversee dozens of societies" requirement. |
| SLA automation + escalation | `SLA_HOURS_BY_CATEGORY` in `complaints.routes.js`, cron in `server.js` | Every complaint gets a `slaDueAt` on creation based on category (e.g. security = 4h, appliance = 72h). A cron job runs every 15 minutes and auto-escalates anything unresolved past its deadline; committees see these at `GET /complaints/escalated`. |
| Predictive maintenance signal | `analytics.routes.js` → `/maintenance-risk` | **Honest scope note:** this is a statistical trend heuristic (complaint rate this 30 days vs. the prior 30, flagged "at risk" past a threshold), not a trained ML model. It's a legitimate, defensible early-warning signal — but if "predictive analytics" specifically means a trained model (e.g. forecasting elevator failure from usage + complaint history), that requires a real dataset and a model training pipeline, which is a separate project this scaffold sets you up to feed data into later. |

## 7. Security notes for deployment
- Rotate `JWT_SECRET` and set a shorter `JWT_EXPIRES_IN` in production (7d is
  a dev convenience).
- Put the API behind HTTPS only; the Android app already sets
  `usesCleartextTraffic="false"`.
- Add refresh tokens if you want silent re-auth instead of forcing re-login
  after expiry — not implemented in this scaffold.
- Validate file uploads (photo attachments on complaints) with a real storage
  service (S3/GCS) + size/type limits before wiring up `multer` for that.
