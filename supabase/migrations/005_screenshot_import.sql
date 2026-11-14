-- 005: AI Screenshot Import.
-- Safe to run more than once. Nothing existing is changed or removed.

-- Where a lead came from (all optional; existing leads simply stay empty).
alter table public.leads add column if not exists address text;
alter table public.leads add column if not exists source text;
alter table public.leads add column if not exists source_batch_id text;
alter table public.leads add column if not exists source_ref text;
alter table public.leads add column if not exists source_confidence numeric;
alter table public.leads add column if not exists source_extracted_at timestamptz;

-- Businesses read from screenshots, waiting for your review.
-- They only become leads (in the same leads table) when you import them.
create table if not exists public.lead_import_records (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null,
  file_name text,
  data jsonb not null default '{}'::jsonb,
  confidence numeric,
  status text not null default 'pending',
  lead_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lead_import_records_status on public.lead_import_records (status, created_at desc);
create index if not exists idx_lead_import_records_batch on public.lead_import_records (batch_id);

-- Locked by default: only the server (after the login check) can read or write.
alter table public.lead_import_records enable row level security;

notify pgrst, 'reload schema';
