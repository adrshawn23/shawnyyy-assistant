-- Migration for databases that already have the initial scaffold tables.
-- Adds missing columns (non-destructive) and creates new tables.

ALTER TABLE workbooks ADD COLUMN IF NOT EXISTS spreadsheet_id TEXT;
ALTER TABLE workbooks ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workbooks_spreadsheet_id_idx ON workbooks(spreadsheet_id) WHERE spreadsheet_id IS NOT NULL;

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS requester_email TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS requested_role TEXT DEFAULT 'viewer';
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS draft_text TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS verification JSONB;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reporting_workbook_id INTEGER REFERENCES workbooks(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS period_start TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS period_end TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reconciliation JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_key_idx ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE rules ADD COLUMN IF NOT EXISTS scope_workbook_ids JSONB;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE rules ADD COLUMN IF NOT EXISTS supersedes_id INTEGER;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- backfill status from legacy is_active flag
UPDATE rules SET status = CASE WHEN is_active THEN 'active' ELSE 'disabled' END WHERE status IS NULL;

CREATE TABLE IF NOT EXISTS verifications (
  id SERIAL PRIMARY KEY,
  access_request_id INTEGER REFERENCES access_requests(id),
  workbook_id INTEGER REFERENCES workbooks(id),
  kind TEXT NOT NULL,
  result TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corrections (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id),
  workbook_id INTEGER REFERENCES workbooks(id),
  kind TEXT NOT NULL,
  previous JSONB,
  proposed JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  workbook_id INTEGER REFERENCES workbooks(id),
  scope_workbook_ids JSONB,
  definition JSONB NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
