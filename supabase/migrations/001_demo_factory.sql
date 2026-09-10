-- ClientRadar Demo Factory: one lead -> one queued demo job.
-- Apply this migration before using /api/demo-jobs.

create table if not exists public.demo_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  template_key text not null default 'auto',
  status text not null default 'queued',
  prompt text not null,
  demo_url text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_demo_jobs_lead_created on public.demo_jobs (lead_id, created_at desc);
create index if not exists idx_demo_jobs_queue on public.demo_jobs (status, created_at);

alter table public.demo_jobs enable row level security;

-- The current ClientRadar API uses the server-only service-role client.
-- These policies are a safe browser default for future authenticated reads.
drop policy if exists "demo_jobs_authenticated_select" on public.demo_jobs;
create policy "demo_jobs_authenticated_select" on public.demo_jobs
  for select to authenticated using (auth.uid() = created_by or created_by is null);

create or replace function public.set_demo_jobs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_demo_jobs_updated_at on public.demo_jobs;
create trigger trg_demo_jobs_updated_at before update on public.demo_jobs
for each row execute function public.set_demo_jobs_updated_at();
