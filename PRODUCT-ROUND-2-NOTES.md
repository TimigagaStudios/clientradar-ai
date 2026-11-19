# ClientRadar product improvements - round 2

Baseline: GitHub main `a9d100f6ea0ad55ca75812671bc5fef4cd3fee0a`, the merge of product-ui-round-1. The round 1 files on main were checked against the delivered ZIP. This is not proof that Vercel deployed the merge.

## What is included

- A shared relative-time display with a tappable Exact control. The exact date and time use the current device's timezone. Relative labels update while the screen remains open. Missing or invalid timestamps are omitted rather than guessed. Your device's clock affects relative labels.
- Lead Detail: lead-added time, recorded outreach times and existing activity journal times.
- Demo Tracking: job creation, start, generation and completion times where available; linked demo creation/generation/record-update times and first/last recorded opens under details. A record update may be a QA check or an open, not necessarily an edit. Opens can include your own visits and repeats.
- AI Team: task creation, start and finish times, plus agent and activity times. The Team API now returns the existing `started_at` value already selected from the database; no new table or field is added.
- Outreach and follow-up batches: batch creation time, not an invented per-draft generation time. Sent history: recorded sent time, not proof of delivery. Replies: reply date; the server can fall back to the saved record date when a received date is missing.
- Three offline tests for relative time, demo timestamp mapping, and the authenticated Team API response.

## Important limits

This is another incremental round, not the completed product project. No historical events are backfilled or invented. Older records without a usable timestamp do not show one. The meaning of existing statuses, demo view counts, external sharing and all existing approval and QA gates is unchanged. A record of a send does not prove delivery.

Website Intelligence, adaptive multipage demo generation, the remaining stateful cross-device audit and other requested product changes are not included in this round. The public-site safety issues identified in the audit still need their own work. No new paid service, API function, SQL migration, environment variable, outreach or customer message is included. There are still 12 non-underscore API TypeScript source files by the prior counting method; the actual Vercel deployment output count has not been independently verified.

## Verification performed

- Production Vite build passed using Node 22. Server-side TypeScript check for `api/team.ts` passed.
- Whole-client TypeScript reports 17 diagnostics, identical to the clean prior baseline. This is not a clean type-check.
- Fifteen offline tests passed, including the three new timestamp tests and the existing AI, QA and message handler tests. Database-backed integration tests were not rerun in this round.
- A synthetic Chromium fixture exercised lead, demo, team, outreach, follow-up, sent-history and reply timestamps at widths 320, 390, 768 and 1280; Exact controls opened and closed without page errors or document-level overflow in those states. Fake data and mocked APIs were used. No customer message was sent.
- These checks are not physical iPhone, iPad or Mac Safari testing and do not prove live deployment or all runtime states.

## Upload

Upload the files in the ZIP to a new branch named `product-activity-round-2`, preserving every folder path. Create and review a pull request into `main`; check its tests before merging. No SQL is needed. After merging, verify Vercel shows Production Ready for the merge commit; GitHub merge alone is not deployment evidence. On your phone, open a lead, a demo's More details, and AI Team; tap Exact next to a time and confirm it shows the right local date and timezone. Do not send test emails to customers.
