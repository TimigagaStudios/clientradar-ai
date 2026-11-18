# QA Agent: release and deployment notes

Status: implemented and locally tested; not pushed or deployed. This package
starts from GitHub main `b7ec471a89cafe85a417b84228a7f280ec16e4bf`. Confirm
main still matches before uploading. If it has moved, stop and reconcile the
changes; do not overwrite newer work. A GitHub upload, a merge, a successful
build and a live production deployment are different events.

## What this release does

- The Team card describes the QA Agent as Active for the specific features
  implemented here. Its activity records are best effort; an activity logging
  failure does not prove the check failed or stop the underlying operation.
- New demos and owner rechecks are screened for missing sections, suspicious
  wording, contact/name differences and sample showcases. When available, the
  saved business website's home-page email and phone contacts are compared.
  A missing or unavailable website is flagged, not treated as proof of error.
  Corrections still require the owner to enter and approve the exact text.
- The QA website reader uses one HTTPS home-page request, a public IPv4 DNS
  check and a pinned connection, with no redirects, query, cookies or login.
  Some legitimate sites, including redirect-only or IPv6-only sites, will be
  unavailable. It cannot prove that a site is official or that its contents
  are correct. The existing, separate Demo Creation website scanner was not
  redesigned by this release.
- First outreach, follow-ups and reply drafts display limited wording checks.
  The separate AI Outreach Generator displays checks for its body and short
  version too. On the server, before an in-app email send, the message is
  screened again, the recipient compared with the saved lead email, and
  possible message contacts compared with the saved lead and available website
  home-page contacts. Different contacts may be yours or formatted differently.
  Linked demo reviews are also checked. Only the send review uses the website;
  the generator's copy-only wording preview does not. Message text is not
  comprehensively fact-checked against the website. Copying text into an
  outside app is not controlled by the server; you control whether it sends.
- All messages and checked demos include a reminder to verify facts. Because
  that is a review finding, expect a QA review/override and a separate send
  confirmation for each email, even if no other wording issue is detected.
  In a batch, the existing batch approval is still required first. Cancelling
  a review stops that email and later batch emails. This is intentionally more
  cautious and may require more taps. No QA check itself sends a message.
- QA override tokens are bound to the message, recipient, lead, mail type,
  saved lead and website contact snapshots, findings and relevant demo review.
  A changed snapshot at the next review requires a new override. The website
  may be read again when you confirm, so slow sites or changing/unavailable
  evidence can require another review. Demo content is protected by the
  existing database mail proof and lock; the saved lead snapshot is NOT locked
  for the full send. Another session can change a lead after the last check,
  so review recipients and facts carefully before confirming. Website content
  can also change after it is read. No check guarantees accuracy.
- Existing demos with older QA reports show stale until rechecked. New reports
  become stale if the demo or selected saved lead fields change, or after
  seven days. Public demo output still strips private QA metadata. Existing
  device-local whitespace opt-in remains off by default; it does not approve
  building demos, editing business facts, or sending email.

## Limits and costs

These are bounded rules, not a comprehensive AI fact checker, tone reviewer,
visual test, link checker, legal or security audit. A checked result is not
proof that facts, claims, addresses, photos or listings are correct. Review
all sample property listings before sharing. A website may be unavailable or
incorrect. The existing built-in fallback can reuse wording from earlier demos.

No new paid service, secret or SQL migration is added. Normal existing
provider/hosting usage can incur charges, and public website visits use network
resources. The QA website checker itself does not call an AI provider.

## iPhone upload steps

1. Download and unzip the package in Files. In Safari, sign in to GitHub and
   open `TimigagaStudios/clientradar-ai`. Use Request Desktop Website if needed.
   Verify main is still the base commit above. Pause other demo builds and sends
   for the deployment window, and check that no email has an uncertain status.
2. Upload to a NEW branch, not directly to main. GitHub's upload page must show
   the correct destination folder each time. Commit the files in these groups
   to the SAME branch:
   - `api`: `demo-jobs.ts`, `send-outreach.ts`, `team.ts`.
   - `api/demo-jobs`: `[id].ts`.
   - `api/lib`: `_qa-agent.ts`, `_qa-demo-agent.ts`, `_qa-outreach.ts`,
     `_qa-website.ts`, `_replies.ts`, `_team.ts`, `demo-job-process.ts`.
   - `src/components`: `DraftQa.tsx`, `QaReviewDialog.tsx`.
   - `src/lib`: `demo-factory.ts`.
   - `src/pages`: `AIOutreach.tsx`, `Demos.tsx`, `FollowUps.tsx`,
     `Outreach.tsx`, `OutreachDrafts.tsx`, `Replies.tsx`.
   - `tests`: all fourteen files from the package's `tests` folder. The SQL
     fixture is for a disposable local test cluster only, never production.
   - Repository root: `QA-AGENT-DEPLOYMENT-NOTES.md`.
   Some paths replace existing files and others are new. If GitHub's picker
   puts files in the wrong folder, stop rather than commit them there.
3. Open the pull request and review Files changed. It must show exactly the
   package paths, no unrelated edits or deletions. Review the Vercel preview
   status, but do not run customer sends or create demos from preview: it might
   share production data. Ask for help if paths, conflicts or build results
   are unclear. Do not run migration 010 again; this update needs no SQL.
4. After review and your decision to deploy, merge the PR and wait for Vercel
   Production to show the matching commit Ready. Verify the commit and that
   owner login still works. Do not treat an upload or preview as live proof.
   If a serious problem appears, pause new builds and sends. A code rollback
   can restore the previous production deployment but does not roll back data.
   Never delete or reset mail claims or retry an uncertain send without first
   checking its real provider result. Ask for help before rolling back.

## Owner-approved post-deployment checks

- Recheck an existing demo without sharing it. Confirm older checks show stale
  before recheck; review the findings, source status, and visible content.
  QA is private; the public preview must not show internal QA metadata.
- With your permission, use a clearly disposable internal lead/demo for a new
  build. Review results and the Team card/activity. An unreadable site is a
  valid unavailable result, not proof that the business has no website.
- For messages, use a disposable test lead and an inbox you control. Prepare
  first outreach, a follow-up and a reply without contacting a real customer.
  Confirm a draft shows findings; cancel QA and confirm nothing is sent; then,
  only if you separately approve a real test email to your own inbox, confirm
  the override and send steps. An email accepted by Brevo is not necessarily
  delivered. If send status is uncertain, check Brevo before any retry.
- Test a changed message/lead and stale demo. An old override must not approve
  the changed review. Do not claim these checks cover every production path.

## Verification performed locally

Node 22 production client build; targeted API TypeScript; deterministic and
mocked provider tests; both demo-generation paths; recheck, privacy and owner
correction mocks; direct send auth/approval/override mocks; isolated website
DNS/HTTPS/redirect/size mocks; synthetic PostgreSQL 17/PostgREST batch,
follow-up, reply, uncertain recovery, concurrency and demo proof-lock tests;
and iPhone-sized Chromium fixture tests for demos, the generator and all four
in-app email views.
No real customer email, provider request or website request was made. The
full client TypeScript check still reports the same 17 diagnostics seen on
unmodified main. Twelve non-underscore API source files are present; actual
Vercel function output has not been independently verified. Mobile fixtures
are not a physical iPhone or production test.
