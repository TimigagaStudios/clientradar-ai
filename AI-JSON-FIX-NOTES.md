# Demo AI JSON handling: deployment notes

Status: tested locally with simulated provider responses; not deployed or
verified with an actual provider. The precise cause of the Point of Sail
warning is unknown. This update may help with some response-format problems;
it is not a guaranteed fix for that incident or every AI error.

## What is included

- `api/lib/demo-ai.ts` is changed; `api/lib/_demo-json.ts` is new.
- `tests/demo-ai-json.test.mjs` and `tests/demo-ai-worker.test.mjs` are new
  offline tests. This document is new. The ZIP contains only these five files.
- No database migration, service, environment setting or automatic retry is
  added. Existing provider use can cost money. One demo request is still sent
  to the configured provider, with the existing timeout.
- The app tries a complete JSON object, including text split into provider
  parts, and conservatively accepts wrappers and repairs only trailing commas
  and literal control characters inside strings. Blocked, explicitly incomplete,
  ambiguous, oversized, empty, and unusable responses fall back instead.
- Successful parsing does not verify the truth, completeness or safety of the
  wording. Existing fallback can borrow text from earlier same-trade AI demos.
  Existing QA is limited and does not prove factual accuracy.

## Before upload

Confirm GitHub main is still at `b021787f893e88b51fb6b502081a2440442d21d1`.
If main has changed, stop and recheck the changes against the new main rather
than overwriting newer code. Keep the previously deployed QA behavior and
approval gates. Do not run migration 010 again; this update needs no SQL.
Do not share secrets or upload them into the repository.

## iPhone: upload with GitHub

These are optional deployment instructions, not evidence of deployment.
On your iPhone, download and unzip the package in Files. Keep the folders.
Open GitHub in Safari and sign in. If needed choose the browser menu and
Request Desktop Website. In `TimigagaStudios/clientradar-ai`:

1. Open the `api/lib` folder on main. Choose Add file, Upload files. Select
   the package's `api/lib/demo-ai.ts` and `api/lib/_demo-json.ts` files from
   Files. Ensure the upload page shows them inside `api/lib`, not at the
   repository root. Existing `demo-ai.ts` should be replaced; `_demo-json.ts`
   should be new. Choose the option to create a new branch and pull request,
   rather than commit directly to main. Use a new branch such as `demo-ai-json-fix`.
2. On that same new branch, open `tests` and use Add file, Upload files to
   add the two test files from the ZIP's `tests` folder. Commit to the same
   branch. At the repository root, upload `AI-JSON-FIX-NOTES.md` on that
   branch as well. If GitHub's mobile picker makes these steps unclear, stop
   and ask for guidance; do not upload every file into one folder.
3. Open the pull request and check its Files changed tab. It should show only
   the five package paths listed above. `api/lib/demo-ai.ts` is modified and
   the other four paths are new. If other paths, deletions, or conflicts
   appear, stop and review them before merging. Check the Vercel preview/build
   status, but do not create demos or send mail from the preview: its settings
   could point at live data. A successful build alone does not verify behavior.
4. If you decide to deploy after review, merge the pull request and wait for
   Vercel to show the matching production deployment as Ready. Verify the
   actual deployed commit separately. Upload, merge and deployment are three
   different events. If deployment fails or unexpected changes appear, stop
   and investigate rather than blindly retrying or reverting database changes.

## Verify only after deployment, with your approval

Point of Sail's existing demo will not change automatically. Review its text
and facts before sharing, especially listings and contact details; QA checked
is not proof. Do not retry that real demo or contact the business as a test.
If Timothy approves, create one clearly disposable internal test lead/demo,
not a real customer's, after checking the provider and possible usage cost.
On the new demo check whether it says AI written or shows an AI-not-used
warning; inspect the actual content and QA result. A Ready/checked result by
itself does not prove the AI was used or that its facts are correct. No email
is needed. If there is a warning, record the displayed message without sharing
keys, raw provider responses, or private business data. Stop and investigate.

## Local verification performed

Node 22.23.5: client production build; targeted server TypeScript check;
existing QA helper tests; mocked parser and provider tests; and a synthetic
shared-worker test for AI success, fallback and QA passed. Tests made no live
provider/database/email calls. The repository inventory has 12 non-underscore
API source files; the deployed Vercel function count was not independently
verified. Full production workflows and a live provider response remain
untested. The separate Team page QA Agent status is not changed by this fix.
