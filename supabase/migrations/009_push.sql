-- ClientRadar push notifications (PWA): lock-screen notifications for replies, drafts and demos.
-- Safe to run more than once. Changes nothing in existing tables.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Locked by default: with row level security on and no policies, the browser
-- cannot read or write this table. Only the server can.
alter table public.push_subscriptions enable row level security;

notify pgrst, 'reload schema';
