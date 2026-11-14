-- ClientRadar AI: Business Tracker (bills, tools, domains).
-- Safe to run more than once. Nothing existing is changed or removed.
-- Never store full card numbers here: "paid_with" is only a nickname such as "Chipper card ending 1234".

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'tool',          -- tool, subscription, domain, other
  status text not null default 'paid',        -- paid, free, paused, cancelled
  amount numeric not null default 0,
  currency text not null default 'USD',
  cycle text not null default 'monthly',      -- monthly, yearly, one-time
  next_due date,
  paid_with text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_business_expenses_due on public.business_expenses (next_due);

-- Locked by default: only the server (after the login check) can read or write.
alter table public.business_expenses enable row level security;

notify pgrst, 'reload schema';
