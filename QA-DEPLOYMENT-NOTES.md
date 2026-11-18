# Demo QA: deployment and verification notes

Status: implementation tested locally; production deployment, production
schema compatibility, Vercel function output, live authentication, provider
behavior, and a physical iPhone are not verified. Do not treat a successful
upload or build as proof that the live app is updated.

## Before applying

1. Back up the database and verify the target Supabase project. Confirm that
   the existing migrations through 009 are applied and that the existing
   `leads`, `outreach_logs`, `agent_tasks`, `demo_jobs`, and
   `outreach_replies` tables and their columns match the SQL and API code.
   The original repository does not contain complete creation SQL for leads
   and outreach logs. Have a qualified database operator review migration
   010 against the real schema, constraints, permissions, and active sends.
2. Finish or resolve any in-progress or uncertain sends before changing the
   database or application. Confirm outcomes with the provider; do not assume
   that a timeout means no email was accepted. Do not retry uncertain sends
   until the actual provider result is known.
3. In the server-side Vercel environment, set `API_ALLOWED_EMAILS` to exactly
   one confirmed owner account, not a comma-separated list. The application
   fails closed for sensitive owner operations if it is missing, contains
   multiple entries, the account is unconfirmed, or `API_AUTH_DISABLED` is
   true. Do not put email values, API keys, or service-role credentials in
   source files or `VITE_` variables. Check that the existing server-only
   Supabase and Brevo settings are correct without exposing their values.
4. Review the SQL in `supabase/migrations/010_qa_send_recovery.sql`. It adds
   mail recovery objects, locks and a trigger, and revokes direct SELECT on
   `demo_jobs` from public, anon, and authenticated roles. Check for external
   clients that rely on that access before applying it. The app uses the
   authenticated API for owner data and the redacted API for public previews.
5. Apply the migration only after the schema and impact review succeeds, then
   deploy the matching code. Verify the target Vercel deployment uses Node 22.
   There are 12 non-underscore API source files in the repository inventory;
   the actual Vercel build output and plan limit must still be checked.
   If setup is incomplete, mail actions are designed to fail closed.

## Verification after deployment

Use a disposable test lead and a test inbox controlled by the owner. Do not
send to a real customer during verification.

- Sign in as the confirmed owner and confirm a different account cannot use
  owner-only operations. Confirm public demo responses do not contain `qa`.
- On an iPhone, build one approved test demo, inspect it, recheck it, and
  confirm unchecked, stale, checked, issues and correction states as relevant.
  With the local minor switch off, no automatic fixes should be applied; with
  it on, only allowed whitespace changes should be applied. The switch does
  not approve demo creation or emails.
- Use the test inbox to confirm QA review or override and send approval are
  separate. Confirm batch, direct, follow-up, reply, and uncertain-outcome
  recovery paths as applicable. A reply with no linked lead cannot be newly
  sent. If the lead is deleted while a reply is already being sent, the reply
  record retains acceptance and no lead-linked outreach log is created. A
  provider acceptance is not proof of delivery. External sharing apps are
  outside server control and their result is unknown.
- Confirm Vercel deployed the intended commit, migration 010 is present, and
  logs and access checks show no errors. Only then describe the live status as
  verified. Keep a rollback plan for both code and database privileges; do not
  remove recovery tables or claims while any send is unresolved.

## Limits

The checker is a limited deterministic content screen, not an audit of factual
accuracy, visual layout, live links, security, legal compliance, or suitability.
A checked result with no findings does not establish that business claims are
true. Existing built-in and AI-generated demo text can contain assumptions;
review every demo and confirm its facts before sharing. Corrections use exact
owner-provided wording. No new paid service is introduced by this change;
existing providers may have their own costs.
