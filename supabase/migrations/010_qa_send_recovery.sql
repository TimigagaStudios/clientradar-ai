-- ClientRadar QA: atomically record an owner-verified batch send outcome.
-- Run after 004_agent_team.sql and after the existing leads/outreach_logs
-- tables exist. The API fails closed if this migration is not installed.
-- This function is server-only. It does not send mail.

-- Keep mail disabled if the migration fails partway through.
create or replace function public.cr_qa_mail_ready() returns boolean
language sql stable security invoker set search_path = pg_catalog, public as $$ select false; $$;
revoke all on function public.cr_qa_mail_ready() from public, anon, authenticated;
grant execute on function public.cr_qa_mail_ready() to service_role;

-- Shared durable lead/phase claim blocks competing direct and batch sends.
create table if not exists public.cr_mail_claims (
  lead_id uuid not null references public.leads(id) on delete restrict,
  mail_kind text not null check (mail_kind in ('intro', 'follow_up')),
  owner_key text not null,
  created_at timestamptz not null default now(),
  primary key (lead_id, mail_kind)
);
alter table public.cr_mail_claims enable row level security;
revoke all on table public.cr_mail_claims from public, anon, authenticated;
grant select, insert, delete on table public.cr_mail_claims to service_role;

create or replace function public.cr_resolve_batch_send(
  p_task_id uuid,
  p_lead_id uuid,
  p_expected_output jsonb,
  p_resolution text
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  t public.agent_tasks%rowtype;
  d jsonb;
  new_drafts jsonb;
  next_output jsonb;
  v_mail_kind text;
  draft_count integer;
  left_count integer;
  uncertain_count integer;
  sent_count integer;
  failed_count integer;
  next_status text;
  finished_at timestamptz;
  stamp timestamptz;
begin
  if p_resolution is null or p_resolution not in ('accepted', 'not_sent', 'provider_accepted', 'skipped') then
    raise exception 'Invalid provider result';
  end if;
  select * into t from public.agent_tasks where id = p_task_id for update;
  if not found or t.agent_key <> 'outreach' or t.status <> 'running'
     or t.output is distinct from p_expected_output then
    raise exception 'Batch changed. Reload and check again';
  end if;
  if jsonb_typeof(t.output->'drafts') <> 'array' then
    raise exception 'Batch drafts are unavailable';
  end if;
  select count(*), (array_agg(value))[1] into draft_count, d
    from jsonb_array_elements(t.output->'drafts')
    where value->>'leadId' = p_lead_id::text;
  if draft_count <> 1 or coalesce(d->>'state', '') not in ('sending', 'unknown') then
    raise exception 'This send does not need resolution';
  end if;
  if p_resolution in ('provider_accepted', 'skipped') and d->>'state' <> 'sending' then
    raise exception 'The send worker no longer owns this draft';
  end if;
  if d->>'state' = 'sending' and p_resolution not in ('provider_accepted', 'skipped') then
    begin
      stamp := (d->>'sendStartedAt')::timestamptz;
    exception when others then
      raise exception 'This send has no valid start time';
    end;
    if stamp is null or stamp > clock_timestamp() - interval '120 seconds' then
      raise exception 'This send may still be running. Wait and check Brevo';
    end if;
  end if;
  v_mail_kind := case when coalesce((t.input->>'followUp')::boolean, false) then 'follow_up' else 'intro' end;
  if p_resolution = 'skipped' and not exists (select 1 from public.outreach_logs
    where lead_id = p_lead_id and (v_mail_kind = 'intro' or type in ('follow_up', 'followup'))) then
    raise exception 'Cannot skip without existing outreach history';
  end if;
  if p_resolution in ('accepted', 'provider_accepted') then
    -- An interrupted worker may already have saved this exact log. Do not
    -- create a second one. Task row lock serializes recovery for this draft.
    if not exists (select 1 from public.outreach_logs
      where lead_id = p_lead_id and type = v_mail_kind and subject = d->>'subject'
        and body = d->>'body' and channel = 'email') then
      insert into public.outreach_logs (lead_id, type, subject, body, channel)
        values (p_lead_id, v_mail_kind, d->>'subject', d->>'body', 'email');
    end if;
    if v_mail_kind = 'intro' then
      update public.leads set status = 'Email Sent',
        demo_status = case when nullif(demo_link, '') is not null
          and strpos(coalesce(d->>'subject', '') || E'\n' || coalesce(d->>'body', ''), demo_link) > 0
          then 'Sent' else demo_status end,
        updated_at = now() where id = p_lead_id;
    else
      update public.leads set updated_at = now() where id = p_lead_id;
    end if;
  end if;
  select jsonb_agg(
    case when value->>'leadId' = p_lead_id::text then
      (value - 'error') || jsonb_build_object('state', case when p_resolution in ('accepted', 'provider_accepted') then 'sent' when p_resolution = 'skipped' then 'skipped' else 'pending' end)
      || case when p_resolution = 'accepted' then jsonb_build_object('error', 'Owner verified provider acceptance; delivery is not confirmed.', 'sentAt', now()) when p_resolution = 'provider_accepted' then jsonb_build_object('sentAt', now()) when p_resolution = 'skipped' then jsonb_build_object('error', 'Already contacted since this draft was written.') else '{}'::jsonb end
    else value end order by ordinality
  ) into new_drafts from jsonb_array_elements(t.output->'drafts') with ordinality;
  select count(*) filter (where value->>'state' = 'pending'),
         count(*) filter (where value->>'state' in ('sending', 'unknown')),
         count(*) filter (where value->>'state' = 'sent'),
         count(*) filter (where value->>'state' = 'failed')
    into left_count, uncertain_count, sent_count, failed_count
    from jsonb_array_elements(new_drafts);
  next_status := case when left_count = 0 and uncertain_count = 0
    then case when sent_count > 0 or failed_count = 0 then 'done' else 'failed' end
    else 'running' end;
  finished_at := case when next_status <> 'running' then now() else null end;
  next_output := jsonb_set(t.output, '{drafts}', new_drafts);
  next_output := jsonb_set(next_output, '{summary}', to_jsonb(
    case when next_status = 'running' then 'Provider result recorded. Review the remaining emails before continuing.'
         else 'Provider result recorded. Delivery is not confirmed.' end));
  delete from public.cr_mail_demo_locks where owner_key = 'batch:' || p_task_id::text || ':' || p_lead_id::text;
  delete from public.cr_mail_claims as claim where claim.lead_id = p_lead_id and claim.mail_kind = v_mail_kind and claim.owner_key = 'batch:' || p_task_id::text || ':' || p_lead_id::text;
  update public.agent_tasks set output = next_output, status = next_status,
    error = case when next_status = 'failed' then 'No email could be sent' else null end,
    completed_at = finished_at, updated_at = now() where id = p_task_id;
  return jsonb_build_object('status', next_status, 'output', next_output);
end;
$$;

revoke all on function public.cr_resolve_batch_send(uuid, uuid, jsonb, text) from public;
revoke all on function public.cr_resolve_batch_send(uuid, uuid, jsonb, text) from anon, authenticated;
grant execute on function public.cr_resolve_batch_send(uuid, uuid, jsonb, text) to service_role;
notify pgrst, 'reload schema';

-- Reply provider acceptance and its history are committed together. Both the
-- successful worker and explicit owner recovery use this transaction.
create or replace function public.cr_resolve_reply_send(
  p_reply_id uuid,
  p_expected_state text,
  p_resolution text
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  r public.outreach_replies%rowtype;
  stamp timestamptz;
  mail_subject text;
  next_state text;
begin
  if p_resolution is null or p_resolution not in ('accepted', 'not_sent', 'provider_accepted') then
    raise exception 'Invalid provider result';
  end if;
  select * into r from public.outreach_replies where id = p_reply_id for update;
  if not found or r.draft_state is distinct from p_expected_state then
    raise exception 'Reply changed. Reload and check again';
  end if;
  if left(r.draft_state, 8) <> 'sending:' and left(r.draft_state, 8) <> 'unknown:' then
    raise exception 'This send does not need resolution';
  end if;
  if p_resolution = 'provider_accepted' and left(r.draft_state, 8) <> 'sending:' then
    raise exception 'The send worker no longer owns this reply';
  end if;
  if left(r.draft_state, 8) = 'sending:' and p_resolution <> 'provider_accepted' then
    begin
      stamp := substring(r.draft_state from 9)::timestamptz;
    exception when others then
      raise exception 'This send has no valid start time';
    end;
    if stamp is null or stamp > clock_timestamp() - interval '120 seconds' then
      raise exception 'This send may still be running. Wait and check Brevo';
    end if;
  end if;
  next_state := case when p_resolution = 'not_sent' then 'ready' else 'sent' end;
  if next_state = 'sent' and r.lead_id is not null then
    mail_subject := case when coalesce(r.subject, '') ~* '^re:' then r.subject else 'Re: ' || coalesce(nullif(r.subject, ''), 'your email') end;
    insert into public.outreach_logs (lead_id, type, subject, body, channel)
      values (r.lead_id, 'reply', mail_subject, r.suggested_reply, 'email');
  end if;
  -- A lead may have been deleted while the provider call was in flight.
  -- Its reply record remains the accepted-send history when no lead exists;
  -- do not try to insert a NULL lead_id into outreach_logs.
  delete from public.cr_mail_demo_locks where owner_key = 'reply:' || p_reply_id::text;
  update public.outreach_replies set draft_state = next_state,
    status = case when next_state = 'sent' then 'handled' else status end
    where id = p_reply_id;
  return jsonb_build_object('id', p_reply_id, 'state', next_state);
end;
$$;

revoke all on function public.cr_resolve_reply_send(uuid, text, text) from public;
revoke all on function public.cr_resolve_reply_send(uuid, text, text) from anon, authenticated;
grant execute on function public.cr_resolve_reply_send(uuid, text, text) to service_role;
notify pgrst, 'reload schema';

-- Durable direct-send claims survive browser refreshes and uncertain network
-- results. A fingerprint is unique across devices for the same message.
create table if not exists public.cr_direct_mail_attempts (
  fingerprint text primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  recipient text not null,
  subject text not null,
  body text not null,
  mail_kind text not null check (mail_kind in ('intro', 'followup')),
  state text not null check (state in ('sending', 'unknown', 'sent', 'not_sent')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One unresolved direct send per lead, even if the message is edited.
create unique index if not exists cr_direct_one_unresolved_per_lead
  on public.cr_direct_mail_attempts (lead_id) where state in ('sending', 'unknown');
alter table public.cr_direct_mail_attempts enable row level security;
revoke all on table public.cr_direct_mail_attempts from anon, authenticated;
grant select, insert, update on table public.cr_direct_mail_attempts to service_role;

create or replace function public.cr_resolve_direct_send(
  p_fingerprint text,
  p_expected_state text,
  p_resolution text
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  r public.cr_direct_mail_attempts%rowtype;
  next_state text;
begin
  if p_resolution is null or p_resolution not in ('accepted', 'not_sent', 'provider_accepted') then
    raise exception 'Invalid provider result';
  end if;
  select * into r from public.cr_direct_mail_attempts where fingerprint = p_fingerprint for update;
  if not found or r.state is distinct from p_expected_state or r.state not in ('sending', 'unknown') then
    raise exception 'This send changed. Reload and check again';
  end if;
  if p_resolution = 'provider_accepted' and r.state <> 'sending' then
    raise exception 'The send worker no longer owns this attempt';
  end if;
  if r.state = 'sending' and p_resolution <> 'provider_accepted' and r.started_at > clock_timestamp() - interval '120 seconds' then
    raise exception 'This send may still be running. Wait and check Brevo';
  end if;
  next_state := case when p_resolution = 'not_sent' then 'not_sent' else 'sent' end;
  if next_state = 'sent' then
    insert into public.outreach_logs (lead_id, type, subject, body, channel)
      values (r.lead_id, r.mail_kind, r.subject, r.body, 'email');
    update public.leads set status = case when r.mail_kind = 'intro' then 'Email Sent' else status end,
      demo_status = case when nullif(demo_link, '') is not null
        and strpos(coalesce(r.subject, '') || E'\n' || coalesce(r.body, ''), demo_link) > 0
        then 'Sent' else demo_status end,
      updated_at = now() where id = r.lead_id;
  end if;
  delete from public.cr_mail_demo_locks where owner_key = 'direct:' || p_fingerprint;
  delete from public.cr_mail_claims as claim where claim.lead_id = r.lead_id and claim.mail_kind = case when r.mail_kind = 'followup' then 'follow_up' else 'intro' end and claim.owner_key = 'direct:' || p_fingerprint;
  update public.cr_direct_mail_attempts set state = next_state, updated_at = now() where fingerprint = p_fingerprint;
  return jsonb_build_object('state', next_state);
end;
$$;
revoke all on function public.cr_resolve_direct_send(text, text, text) from public;
revoke all on function public.cr_resolve_direct_send(text, text, text) from anon, authenticated;
grant execute on function public.cr_resolve_direct_send(text, text, text) to service_role;


notify pgrst, 'reload schema';

-- Demo QA metadata is private. The current app reads previews through the
-- server's explicitly public redacted endpoint, not directly from this table.
revoke select on table public.demo_jobs from public, anon, authenticated;
grant select on table public.demo_jobs to service_role;
notify pgrst, 'reload schema';

-- A linked preview is held unchanged while its email is being submitted or
-- remains uncertain. Statistics-only writes remain allowed. The proof and
-- lock are acquired in the same transaction as a mail claim.
create table if not exists public.cr_mail_demo_locks (
  demo_id uuid not null,
  owner_key text not null,
  primary key (demo_id, owner_key)
);
alter table public.cr_mail_demo_locks enable row level security;
revoke all on table public.cr_mail_demo_locks from public, anon, authenticated;
grant select, insert, delete on table public.cr_mail_demo_locks to service_role;

create or replace function public.cr_lock_demo_proofs(p_proofs jsonb, p_owner_key text) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  proof jsonb;
  job public.demo_jobs%rowtype;
  job_exists boolean;
  job_id uuid;
begin
  if p_owner_key is null or p_proofs is null or jsonb_typeof(p_proofs) <> 'array' or jsonb_array_length(p_proofs) > 100 then
    raise exception 'Invalid demo proof';
  end if;
  for proof in select value from jsonb_array_elements(p_proofs) order by value->>'id' loop
    job_id := (proof->>'id')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(job_id::text, 0));
    select * into job from public.demo_jobs where id = job_id for update;
    job_exists := found;
    if job_exists is distinct from coalesce((proof->>'exists')::boolean, false) then
      raise exception 'Demo changed. Review again before sending';
    end if;
    if job_exists and (job.status is distinct from proof->>'status'
      or (job.content - 'stats') is distinct from ((proof->'content') - 'stats')) then
      raise exception 'Demo changed. Review again before sending';
    end if;
    insert into public.cr_mail_demo_locks (demo_id, owner_key) values (job_id, p_owner_key) on conflict do nothing;
  end loop;
end;
$$;
revoke all on function public.cr_lock_demo_proofs(jsonb, text) from public, anon, authenticated;
grant execute on function public.cr_lock_demo_proofs(jsonb, text) to service_role;

create or replace function public.cr_protect_demo_during_send() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  job_id uuid;
begin
  job_id := case when tg_op = 'DELETE' then old.id else new.id end;
  -- Row-update triggers may already hold a row lock. Never wait here on the
  -- advisory lock held by a claimant waiting for that row; fail safely.
  if not pg_try_advisory_xact_lock(hashtextextended(job_id::text, 0)) then
    raise exception 'Demo is being reviewed for an email. Try again shortly';
  end if;
  if exists (select 1 from public.cr_mail_demo_locks where demo_id = job_id) then
    if tg_op <> 'UPDATE' then raise exception 'Demo is locked while an email send is uncertain'; end if;
    if old.status is distinct from new.status or (old.content - 'stats') is distinct from (new.content - 'stats') then
      raise exception 'Demo is locked while an email send is uncertain';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists cr_protect_demo_during_send on public.demo_jobs;
create trigger cr_protect_demo_during_send before insert or update or delete on public.demo_jobs
for each row execute function public.cr_protect_demo_during_send();

-- Atomically claim a batch draft and the lead's outgoing-mail phase.
drop function if exists public.cr_claim_batch_send(uuid, uuid, jsonb);
create or replace function public.cr_claim_batch_send(p_task_id uuid, p_lead_id uuid, p_expected_output jsonb, p_demo_proofs jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  t public.agent_tasks%rowtype;
  chosen jsonb;
  draft_count integer;
  new_drafts jsonb;
  mail_kind text;
begin
  select * into t from public.agent_tasks where id = p_task_id for update;
  if not found or t.agent_key <> 'outreach' or t.status <> 'running' or t.output is distinct from p_expected_output then
    raise exception 'Batch changed. Reload and check again';
  end if;
  if jsonb_typeof(t.output->'drafts') <> 'array' then raise exception 'Batch drafts unavailable'; end if;
  if exists (select 1 from jsonb_array_elements(t.output->'drafts') where value->>'state' in ('sending', 'unknown')) then
    raise exception 'Another send is in progress or uncertain';
  end if;
  select count(*), (array_agg(value))[1] into draft_count, chosen from jsonb_array_elements(t.output->'drafts') where value->>'leadId' = p_lead_id::text;
  if draft_count <> 1 or coalesce(chosen->>'state', '') <> 'pending' then raise exception 'This draft is not pending'; end if;
  mail_kind := case when coalesce((t.input->>'followUp')::boolean, false) then 'follow_up' else 'intro' end;
  perform public.cr_lock_demo_proofs(p_demo_proofs, 'batch:' || p_task_id::text || ':' || p_lead_id::text);
  insert into public.cr_mail_claims (lead_id, mail_kind, owner_key) values (p_lead_id, mail_kind, 'batch:' || p_task_id::text || ':' || p_lead_id::text);
  select jsonb_agg(case when value->>'leadId' = p_lead_id::text then value || jsonb_build_object('state', 'sending', 'sendStartedAt', now()) else value end order by ordinality)
    into new_drafts from jsonb_array_elements(t.output->'drafts') with ordinality;
  update public.agent_tasks set output = jsonb_set(t.output, '{drafts}', new_drafts), updated_at = now() where id = p_task_id returning output into t.output;
  return jsonb_build_object('output', t.output);
end;
$$;
revoke all on function public.cr_claim_batch_send(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.cr_claim_batch_send(uuid, uuid, jsonb, jsonb) to service_role;

-- Atomically claim a direct message and the same lead/phase guard.
drop function if exists public.cr_claim_direct_send(text, uuid, text, text, text, text);
create or replace function public.cr_claim_direct_send(p_fingerprint text, p_lead_id uuid, p_recipient text, p_subject text, p_body text, p_mail_kind text, p_demo_proofs jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  r public.cr_direct_mail_attempts%rowtype;
  existing public.cr_direct_mail_attempts%rowtype;
  guard_kind text;
begin
  if p_fingerprint !~ '^[a-f0-9]{64}$' or p_mail_kind not in ('intro', 'followup') then raise exception 'Invalid mail claim'; end if;
  select * into existing from public.cr_direct_mail_attempts where fingerprint = p_fingerprint for update;
  if found and existing.state <> 'not_sent' then
    return jsonb_build_object('claimed', false, 'state', existing.state, 'fingerprint', existing.fingerprint, 'recipient', existing.recipient, 'subject', existing.subject);
  end if;
  guard_kind := case when p_mail_kind = 'followup' then 'follow_up' else 'intro' end;
  perform public.cr_lock_demo_proofs(p_demo_proofs, 'direct:' || p_fingerprint);
  insert into public.cr_mail_claims (lead_id, mail_kind, owner_key) values (p_lead_id, guard_kind, 'direct:' || p_fingerprint);
  insert into public.cr_direct_mail_attempts (fingerprint, lead_id, recipient, subject, body, mail_kind, state, started_at, updated_at)
    values (p_fingerprint, p_lead_id, p_recipient, p_subject, p_body, p_mail_kind, 'sending', now(), now())
    on conflict (fingerprint) do update set state = 'sending', started_at = now(), updated_at = now()
    where public.cr_direct_mail_attempts.state = 'not_sent'
    returning * into r;
  if r.fingerprint is null then raise exception 'Another send already claimed this message'; end if;
  return jsonb_build_object('claimed', true, 'state', r.state, 'fingerprint', r.fingerprint);
end;
$$;
revoke all on function public.cr_claim_direct_send(text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cr_claim_direct_send(text, uuid, text, text, text, text, jsonb) to service_role;


notify pgrst, 'reload schema';

create or replace function public.cr_claim_reply_send(p_reply_id uuid, p_expected_email text, p_body text, p_demo_proofs jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  r public.outreach_replies%rowtype;
  claim text;
begin
  select * into r from public.outreach_replies where id = p_reply_id for update;
  if not found or r.draft_state <> 'ready' or r.from_email is distinct from p_expected_email then
    raise exception 'Reply changed or another send started';
  end if;
  if r.lead_id is null then
    raise exception 'This reply has no linked lead. No email was sent';
  end if;
  perform public.cr_lock_demo_proofs(p_demo_proofs, 'reply:' || p_reply_id::text);
  claim := 'sending:' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  update public.outreach_replies set draft_state = claim, suggested_reply = p_body where id = p_reply_id;
  return jsonb_build_object('state', claim);
end;
$$;
revoke all on function public.cr_claim_reply_send(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cr_claim_reply_send(uuid, text, text, jsonb) to service_role;

create or replace function public.cr_qa_mail_ready() returns boolean
language sql stable security invoker set search_path = pg_catalog, public as $$
  select to_regprocedure('public.cr_resolve_batch_send(uuid,uuid,jsonb,text)') is not null
     and to_regprocedure('public.cr_resolve_reply_send(uuid,text,text)') is not null
     and to_regprocedure('public.cr_resolve_direct_send(text,text,text)') is not null
     and to_regprocedure('public.cr_claim_batch_send(uuid,uuid,jsonb,jsonb)') is not null
     and to_regprocedure('public.cr_claim_direct_send(text,uuid,text,text,text,text,jsonb)') is not null
     and to_regprocedure('public.cr_claim_reply_send(uuid,text,text,jsonb)') is not null
     and to_regprocedure('public.cr_protect_demo_during_send()') is not null
     and to_regclass('public.cr_mail_claims') is not null
     and to_regclass('public.cr_direct_mail_attempts') is not null
     and to_regclass('public.cr_mail_demo_locks') is not null
     and exists (select 1 from pg_trigger where tgrelid = to_regclass('public.demo_jobs') and tgname = 'cr_protect_demo_during_send' and not tgisinternal and tgenabled <> 'D');
$$;
notify pgrst, 'reload schema';
