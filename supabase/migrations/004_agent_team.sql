-- ClientRadar AI team, Phase 1: task records and the central activity log.
-- Safe to run more than once. It only ADDS two new tables; no existing table is changed.
-- Run it once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null,
  parent_task_id uuid references public.agent_tasks(id) on delete set null,
  title text not null,
  status text not null default 'queued',
  requested_by text not null default 'system',
  lead_id uuid references public.leads(id) on delete set null,
  input jsonb,
  output jsonb,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_agent_tasks_agent_created on public.agent_tasks (agent_key, created_at desc);
create index if not exists idx_agent_tasks_status_created on public.agent_tasks (status, created_at);

create table if not exists public.agent_activity (
  id bigint generated always as identity primary key,
  agent_key text not null,
  task_id uuid references public.agent_tasks(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  kind text not null,
  summary text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_activity_created on public.agent_activity (created_at desc);
create index if not exists idx_agent_activity_agent_created on public.agent_activity (agent_key, created_at desc);

-- Locked by default: with row level security on and no policies, the browser
-- cannot read or write these tables. Only the server (after the login check) can.
alter table public.agent_tasks enable row level security;
alter table public.agent_activity enable row level security;

-- Tell the API layer about the new tables straight away.
notify pgrst, 'reload schema';
