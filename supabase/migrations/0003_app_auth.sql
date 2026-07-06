-- Single-row table holding the app's (resettable) login password + reset token.
-- Lets the password be changed at runtime (for "forgot password" email reset),
-- unlike the static APP_PASSWORD env var.
create table if not exists app_auth (
  id                integer primary key default 1 check (id = 1),
  password_hash     text,
  reset_token_hash  text,
  reset_expires_at  timestamptz,
  updated_at        timestamptz not null default now()
);

insert into app_auth (id) values (1) on conflict (id) do nothing;
