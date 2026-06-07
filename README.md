# VendorBridge

**Procurement & Vendor Management SaaS** — runs the full procurement lifecycle on one platform: vendors, RFQs, quotations, side-by-side comparison, approvals, and auto-generated purchase orders & GST invoices, with a complete audit trail and analytics.

Built and maintained by **Agam Sharma**.

---

## Tech stack

| Layer    | Technology |
|----------|------------|
| Backend  | Node.js + Express (REST API) |
| Database | MySQL 8 — raw, parameterised `mysql2` queries (no ORM) |
| Auth     | JWT (stateless) + bcrypt password hashing + role guards |
| Security | helmet (CSP), CORS allow-list, rate limiting, input validation |
| Frontend | Vanilla-JS SPA (no build step), hand-built SVG charts |
| Deploy   | Docker + docker-compose (app + MySQL) |

The approve → PO + invoice step runs inside a single MySQL **transaction**, and all human-readable codes (`RFQ-…`, `PO-2026-…`, `INV-2026-…`) are derived from the row's own auto-increment id, so they are collision-free under concurrency.

---

## Features

- **Role-based access** — Procurement Officer, Vendor, Manager/Approver, Admin. Each role gets a tailored workspace and a scoped API.
- **Vendor self-registration** — vendors sign up themselves (always created as `vendor`); buyers/managers/admins are created internally by an admin.
- **Vendor management** — directory with category, GST, contacts, rating, status; search & filter.
- **RFQ lifecycle** — create an RFQ, invite vendors, collect quotations (state-guarded: quoting only while Open).
- **Quotation comparison** — side-by-side matrix with lowest-price auto-highlight, sortable by price / delivery / rating.
- **Approval workflow** — recommend → review → approve/reject; an approval **auto-generates a PO and a GST invoice in one transaction**.
- **Documents** — POs & invoices with 18% GST; print and download as PDF; email + mark-paid actions.
- **Activity log & notifications** — every meaningful action recorded for audit.
- **Reports & analytics** — real spend trends (computed from invoices), pipeline, spend-by-vendor, vendor win-rate.

---

## Quick start (Docker — recommended)

```bash
cp .env.example .env          # then edit: JWT_SECRET, ADMIN_*, DB_PASSWORD
docker compose up --build
```

This starts MySQL, waits until it is healthy, builds the schema, creates your admin from `ADMIN_*`, and launches the API. Open **http://localhost:4000** and sign in with the admin credentials you set.

---

## Quick start (local Node)

### Prerequisites
- Node.js 18+
- MySQL 8+ (or MariaDB 10.4+) running locally

```bash
npm install
cp .env.example .env          # set DB_* and a strong JWT_SECRET

npm run db:init               # creates the schema (idempotent, no demo data)

ADMIN_NAME="Your Name" ADMIN_EMAIL="you@company.com" ADMIN_PASSWORD="secret123" \
  npm run create:admin        # create the owner/admin account

npm start                     # → http://localhost:4000
```

> `npm run db:init` is safe to re-run — it only creates tables that don't exist.
> For a clean development reset: `mysql -e 'DROP DATABASE vendorbridge;' && npm run db:init`.

---

## How accounts work (no demo data)

VendorBridge ships with **no seeded users or business data**. Accounts come from three places:

1. **Admin** — created once via `npm run create:admin` (or `ADMIN_*` in Docker).
2. **Officers / Managers / Admins** — created by an admin in **Administration → User Management** (or `POST /api/users`).
3. **Vendors** — self-register from the sign-in screen ("Create an account"). Public registration is **always** a `vendor` account; the role cannot be chosen by the client.

---

## Security

- Public registration cannot escalate privileges — role is forced to `vendor` server-side.
- `JWT_SECRET` is required in production (the server refuses to start without a strong one).
- `helmet` sets a strict Content-Security-Policy; CORS is configurable via `CORS_ORIGIN`.
- Rate limiting: 30 auth attempts / 15 min, 240 API requests / min.
- All mutating endpoints validate input (types, ranges, lengths) and enforce role + ownership checks.
- Passwords hashed with bcrypt; SQL fully parameterised.

---

## API overview

All `/api/*` routes except `auth/login` and `auth/register` require `Authorization: Bearer <token>`.

```
GET    /api/health                         # liveness
GET    /api/ready                          # readiness (pings DB)

POST   /api/auth/register                  # PUBLIC — always creates a vendor
POST   /api/auth/login
GET    /api/auth/me
GET    /api/bootstrap                       # role-scoped snapshot for the SPA

GET    /api/users          POST /api/users  # admin: list / create internal users

GET    /api/vendors        POST /api/vendors        PATCH /api/vendors/:id
GET    /api/rfqs           POST /api/rfqs           GET   /api/rfqs/:id
POST   /api/rfqs/:id/quotations             # vendor submits/updates a quote
POST   /api/rfqs/:id/send-approval          # officer recommends a quote

GET    /api/approvals      POST /api/approvals/:id/decide   # transaction → PO + invoice

GET    /api/orders/purchase-orders
GET    /api/orders/invoices
POST   /api/orders/invoices/:id/email
POST   /api/orders/invoices/:id/pay

GET    /api/activity
```

---

## Project structure

```
vendorbridge/
├── server/
│   ├── index.js                 # Express bootstrap, security middleware, static SPA host
│   ├── config.js                # env config + production guards
│   ├── db.js                    # MySQL pool + query/transaction/ping helpers
│   ├── validate.js              # input validation helpers
│   ├── util.js                  # activity logging, code helpers
│   ├── middleware/auth.js       # JWT sign/verify + role guards
│   └── routes/                  # auth, users, vendors, rfqs, approvals, orders, activity, bootstrap
├── database/schema.sql          # idempotent DDL (tables, FKs, indexes)
├── scripts/
│   ├── initDb.js                # build schema
│   └── createAdmin.js           # create/reset the admin account
├── public/                      # SPA (index.html, css/styles.css, js/{ui,api,app}.js)
├── Dockerfile  docker-compose.yml  .dockerignore
├── .env.example
└── package.json
```

---

## Roadmap (next hardening steps)

Pagination on list endpoints, refresh-token rotation, vendor RFQ attachments (object storage), and versioned DB migrations (e.g. Knex/Prisma) in place of the bootstrap script.

## License
MIT © 2026 Agam Sharma
