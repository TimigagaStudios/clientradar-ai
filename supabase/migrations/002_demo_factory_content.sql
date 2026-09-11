-- ClientRadar Demo Factory: generated content for a ready preview.
-- Run after 001_demo_factory.sql.

alter table public.demo_jobs
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists generated_at timestamptz;
