-- ClientRadar map coordinates for saved leads.
-- Run after the Demo Factory migrations if those are already applied.

alter table public.leads
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists idx_leads_coordinates on public.leads (latitude, longitude);
