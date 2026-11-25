-- OAuth tokens for connected Google account (Drive/Sheets access via user's own login)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'google',
  email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
