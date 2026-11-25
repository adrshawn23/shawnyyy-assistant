-- Shawn Assistant — initial schema
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workbooks (
  id SERIAL PRIMARY KEY,
  spreadsheet_id TEXT UNIQUE,
  url TEXT NOT NULL,
  name TEXT,
  owner_email TEXT,
  is_demo BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_requests (
  id SERIAL PRIMARY KEY,
  workbook_id INTEGER REFERENCES workbooks(id),
  requester_email TEXT,
  owner_email TEXT,
  reason TEXT,
  requested_role TEXT DEFAULT 'viewer',
  status TEXT DEFAULT 'pending',
  draft_text TEXT,
  verification JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verifications (
  id SERIAL PRIMARY KEY,
  access_request_id INTEGER REFERENCES access_requests(id),
  workbook_id INTEGER REFERENCES workbooks(id),
  kind TEXT NOT NULL,
  result TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  workbook_id INTEGER REFERENCES workbooks(id),
  reporting_workbook_id INTEGER REFERENCES workbooks(id),
  type TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  period_start TEXT,
  period_end TEXT,
  idempotency_key TEXT,
  result JSONB,
  reconciliation JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- idempotency index is created in 0002 (after column exists on legacy tables)

CREATE TABLE IF NOT EXISTS rules (
  id SERIAL PRIMARY KEY,
  workbook_id INTEGER REFERENCES workbooks(id),
  scope_workbook_ids JSONB,
  type TEXT NOT NULL,
  name TEXT,
  definition JSONB NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  status TEXT DEFAULT 'active',
  supersedes_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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
