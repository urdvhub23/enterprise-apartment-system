<<<<<<< HEAD
# Apartment Management System

A full-stack apartment management platform: React web app + installable
staff PWA, a Node.js/Express API gateway with service-oriented modules, a
PostgreSQL + MongoDB polyglot database layer, and a native Android scaffold.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system
design and deployment topology.

## Project layout

```
apartment-app/
├── backend/     Node.js/Express API gateway + service modules
├── frontend/    React + Vite web app (also the staff PWA)
├── android/     Native Android (Java) scaffold
└── docs/        Architecture documentation
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or a connection string to a hosted one)
- MongoDB 6+ running locally (or a connection string to Atlas/hosted one)

## 1. Backend setup

```bash
cd backend
cp .env.example .env
# edit .env with your Postgres/Mongo credentials and a real JWT_SECRET
npm install
npm run seed   # creates demo admin + tenant + apartment + lease
npm run dev    # starts on http://localhost:5000
```

Demo accounts created by the seed script:
- `enterprise@apartments.test` / `Password123!` (super_admin, no society — sees the cross-society analytics view)
- `admin@apartments.test` / `Password123!` (property_manager, scoped to "Maple Court Society")
- `gate@apartments.test` / `Password123!` (staff — use this one for the gate log / visitor check-in view)
- `tenant@apartments.test` / `Password123!` (resident)

After seeding, also run the one-off migration that adds the Postgres-level
double-booking guarantee for facility reservations:

```bash
npm run migrate
```

## 2. Frontend setup

```bash
cd frontend
npm install
npm run dev    # starts on http://localhost:5173, proxies /api to :5000
```

Open `http://localhost:5173` and sign in with a demo account. The same build
works as an installable PWA — visit the deployed URL on a phone and use
"Add to Home Screen" / the browser's install prompt.

Build for production:
```bash
npm run build   # outputs to frontend/dist
```

## 3. Android app

Open `android/` in Android Studio (Hedgehog+). Before building:
1. Edit `android/app/build.gradle` — set `API_BASE_URL` to your deployed
   API gateway URL (must be HTTPS for release builds).
2. Sync Gradle, run on an emulator or device.

This is a working scaffold (login → dashboard → maintenance list → billing
list, all wired to the real API) — extend it with more screens as needed;
see `docs/ARCHITECTURE.md` §2 for what's intentionally left out and why.

## What's implemented

- JWT auth with roles: `super_admin`, `property_manager`, `staff`, `tenant`
- Units/apartments CRUD, tenant-to-unit lease assignment
- Invoice issuing + payments processed inside a DB transaction
  (`billing.routes.js`) with automatic partial/paid status
- Maintenance ticket lifecycle (open → in progress → resolved → closed)
  with comments
- Building-wide notices/announcements
- Realtime tenant↔staff support chat (Socket.IO)
- In-app notification feed, triggered automatically by billing and
  complaint events
- Daily cron job marking overdue invoices
- Installable PWA build for staff
- Android scaffold hitting the same API

## What's not implemented (by design, flagged for your next steps)

- Payment gateway integration (Stripe/Razorpay etc.) — `payments` endpoint
  currently accepts a payment as "completed" directly; wire in a real
  processor's webhook before going live with real money
- File/photo upload storage (S3/GCS) for complaint attachments
- Refresh tokens / silent re-auth
- Dockerfiles and CI/CD pipeline
- Push notifications (FCM) for Android/web
- Automated tests

Happy to build out any of these next — just say which one.
=======
# enterprise-apartment-system
Inspired by "Apartment System problems" this scalable Apartment Management System (AMS) centralizes operations, eliminating manual tracking and fragmented communication. Built on open-source DevOps, it ensures 99.9% uptime, strict security, and seamless updates, scaling from single complexes to multi-tenant enterprises.
>>>>>>> 10906c25a4cacf79cd971dca72268235defcd91b
