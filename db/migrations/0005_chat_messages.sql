CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  email TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  kind TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages (created_at);
