# Shawn — AI Work Assistant

Private internal AI assistant for company Google Sheets operations. Understands short commands in English or Bisaya, cleans raw data, generates formulas, builds hub reports, and learns from approved corrections.

**Stack:** Next.js (App Router) · TypeScript · Neon Postgres (Drizzle) · Google Sheets API (service account) · Tailwind CSS.

## Screens

- **Command Center** (`/`) — chat terminal + quick commands + job log
- **Access Requests** (`/access`) — draft owner requests, preview/copy, verify, revoke
- **Data Review** (`/data-review`) — job detail: reconciliation, KPIs, exceptions, publish info
- **Dashboard** (`/dashboard`) — latest hub report KPIs, trends, hub comparison
- **Rules & Learning** (`/rules`) — approved rules, version history, pending corrections, saved workflows

## Quick start (demo — no Google credentials)

```bash
npm install
cp .env.example .env
# set DATABASE_URL, SHAWN_LOGIN_EMAIL, SHAWN_LOGIN_PASSWORD, AUTH_SECRET
# keep DEMO_MODE=true
npm run db:migrate
npm run dev
```

Open http://localhost:3000, sign in, then try:

- `clean this raw data and build this week's hub report`
- `show job status`
- `find latest matching entry`
- `Shawn, remember this process`

Demo mode uses built-in sample data covering leading-zero IDs, repeated shipment events, blanks, invalid dates, and inconsistent hub names. Demo workbooks: `demo-hub-raw` (source), `demo-hub-report` (reporting), `demo-daily-entry` (out-of-order log).

## Live Google Sheets setup

1. Create a Google Cloud project, enable **Google Sheets API** and **Google Drive API**.
2. Create a **service account**, download the JSON key.
3. Set `GOOGLE_SERVICE_ACCOUNT_JSON` to the full JSON (single line) and `SHAWN_SERVICE_ACCOUNT_EMAIL` to its `client_email`. Set `DEMO_MODE=false`.
4. Share source workbooks with the service account as **Viewer**; share separate reporting workbooks as **Editor**.

## Access requests

Access → enter Sheet URL, owner email, reason, and role (Viewer for sources, Editor for reporting). Shawn drafts the request with the service-account email; preview and copy it, then send through the authorized company sender. Shawn verifies real access under its own credentials before every use and re-checks before each job. `Pending / Verified / Revoked` are tracked in Neon; network/config failures are reported distinctly from denied access.

## Commands

| Command | Action |
|---|---|
| `clean this raw data and build this week's hub report` | clean + KPIs + reconcile + publish to reporting workbook |
| `clean sheet` | clean + reconcile only (no publish) |
| `build dashboard` | hub report |
| `find latest matching entry` | paste-ready formula (append-ordered log) |
| `latest match by date` | paste-ready formula (out-of-order log, timestamp + tie-break) |
| `second occurrence` | nth-match formula |
| `show job status` | recent jobs |
| `Shawn, remember this process` | save verified workflow |
| `same as last time` | reuse saved workflow for this workbook |
| `... instead / dapat ...` | record a correction for rule approval |

## Learning

Corrections are recorded with previous vs proposed behavior. Approve **use once**, **this workbook**, or **global** under Rules. Approved rules apply automatically within scope; conflicts, changed headers, and failed checks pause the job. Rules and workflows persist in Neon and survive restarts. Learning never expands access or authorizes writes.

## Data rules

- Raw values are preserved for review; cleaning trims spaces, standardizes hub/status aliases, normalizes dates, and preserves leading zeros (IDs stay strings).
- Flags: missing ID, invalid/missing date, unknown alias, missing hub, accidental duplicates. Repeated shipment events (same ID, different status/date) are distinguished from exact duplicates.
- KPIs count **events** (clean rows) or **shipments** (distinct Tracking IDs); flagged rows are excluded. Date field: Event Date.
- Reconciliation requires source = clean + flagged and filtered totals to match; publishing pauses on failure.
- Writes go only to the approved reporting workbook tabs/ranges, after permission checks, and are idempotent via `jobs.idempotency_key`.

## Verification status

- **Verified locally (demo):** full pipeline — cleaning, KPIs, reconciliation, idempotent retry, formula generation, learning flow.
- **Mocked:** Google access verification (demo returns simulated success).
- **Unverified without live credentials:** real Sheets read/write, Drive permission checks, email sending.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run db:migrate # apply db/migrations/*.sql to DATABASE_URL
```
