-- ClientRadar reply inbox: replies from clients to outreach emails.
-- Safe to run more than once. Changes nothing in existing tables.

create table if not exists public.outreach_replies (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  message_id text not null unique,
  from_email text not null,
  from_name text,
  subject text,
  body text,
  received_at timestamptz,
  label text not null default 'other',
  score integer not null default 0,
  reason text,
  scored_by text not null default 'rules',
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists idx_outreach_replies_created on public.outreach_replies (created_at desc);
create index if not exists idx_outreach_replies_lead on public.outreach_replies (lead_id);

-- Locked by default: with row level security on and no policies, the browser
-- cannot read or write this table. Only the server can.
alter table public.outreach_replies enable row level security;

notify pgrst, 'reload schema';
