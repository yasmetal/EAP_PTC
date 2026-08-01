# EAP_PTC — Warehouse Fulfillment ERP

An internal, Thai-language ERP for a fulfillment/warehouse operation: inbound receiving, order
allocation, barcode pick/pack, shipping, billing & invoicing, returns, reporting, and an
activity log — all behind role-based access control.

## Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions, Turbopack)
- TypeScript (strict)
- PostgreSQL + [Prisma](https://www.prisma.io)
- [NextAuth](https://authjs.dev) (credentials provider, JWT sessions, RBAC)
- Tailwind CSS + shadcn/ui
- Zod for validation
- Docker Compose for local Postgres / containerized deploy

## Features

- **Auth & RBAC** — 5 roles (warehouse staff, admin/CS, supervisor, accounting, owner), enforced
  in middleware, server components, and server actions.
- **Merchants, products, inventory** — CRUD + per-bin stock tracking.
- **Inbound receiving** — barcode-driven stock intake.
- **Orders** — creation, stock allocation, pick-list generation.
- **Pick & pack** — barcode scanning UX for warehouse staff.
- **Shipping** — courier/tracking capture, atomic stock reservation (race-safe under concurrent
  allocation).
- **Billing & invoicing** — auto-populated line items from shipped orders, draft → issued → paid
  workflow, Thai-formatted PDF invoices.
- **Returns** — intake → inspection → resolution, with optional restock-to-bin.
- **Reporting dashboard** and **activity log** viewer.
- **User & role management** admin UI, with failed-login lockout.
- Every stock/financial mutation is transactional and recorded to an activity log.

## Getting started

1. Copy the env template and set a real secret:

   ```bash
   cp .env.example .env
   # generate a value for NEXTAUTH_SECRET, e.g.:
   openssl rand -base64 32
   ```

2. Start Postgres (or run the whole stack) with Docker Compose:

   ```bash
   docker compose up -d postgres
   ```

3. Install dependencies, run migrations, and seed sample data:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

Seeded login credentials (see `prisma/seed.ts`) are printed to the console after seeding.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Lint |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |

## Deployment

`docker compose up` builds and runs the full stack (Postgres + app) using the multi-stage
`Dockerfile` (standalone Next.js output). `NEXTAUTH_SECRET` must be set in the environment or the
container will refuse to start.
