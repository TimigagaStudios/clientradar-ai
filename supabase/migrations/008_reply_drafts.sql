-- ClientRadar suggested reply drafts: the Customer Communication Agent writes a suggested
-- answer for promising replies; the owner reads it on the Replies page and only his
-- approval sends it. Safe to run more than once. Changes nothing else.

alter table public.outreach_replies add column if not exists suggested_reply text;
alter table public.outreach_replies add column if not exists draft_state text not null default 'none';
alter table public.outreach_replies add column if not exists draft_by text;

notify pgrst, 'reload schema';
