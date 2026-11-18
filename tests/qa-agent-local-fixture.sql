-- DISPOSABLE LOCAL TEST CLUSTER ONLY. Never run on production or Supabase.
-- web_anon bypasses RLS here solely to simulate a service-role API fixture.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role web_anon nologin bypassrls;
grant service_role to web_anon;
create schema qa_test;
create table qa_test.demo_jobs(id uuid primary key, lead_id uuid, status text not null, content jsonb not null default '{}', attempts int not null default 0, started_at timestamptz);
create table qa_test.agent_tasks(id uuid primary key default gen_random_uuid(), status text not null, output jsonb not null default '{}', agent_key text, input jsonb, title text, attempts int default 0, started_at timestamptz, updated_at timestamptz, completed_at timestamptz, error text, created_at timestamptz default now(), parent_task_id uuid, lead_id uuid, requested_by text);
create table qa_test.leads(id uuid primary key, status text, demo_status text, updated_at timestamptz, business_name text, email text, phone text, website text, demo_link text);
create table qa_test.outreach_logs(id bigint generated always as identity primary key, lead_id uuid, type text, subject text, body text, channel text, sent_at timestamptz);
create table qa_test.agent_activity(id bigint generated always as identity primary key, agent_key text, task_id uuid, lead_id uuid, kind text, summary text, created_at timestamptz default now());
create table qa_test.outreach_replies(id uuid primary key, lead_id uuid, draft_state text, suggested_reply text, draft_by text, from_email text, from_name text, subject text, status text);
grant usage on schema qa_test to web_anon, service_role;
grant all on all tables in schema qa_test to web_anon, service_role;
grant usage,select on all sequences in schema qa_test to web_anon, service_role;
alter table qa_test.demo_jobs add constraint demo_jobs_lead_id_fkey foreign key (lead_id) references qa_test.leads(id);
