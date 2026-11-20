CREATE TABLE app.zen_state (
  key text PRIMARY KEY,
  version bigint NOT NULL DEFAULT 1,
  token text NOT NULL DEFAULT '',
  expires_at bigint NOT NULL DEFAULT 0,
  value jsonb
);
