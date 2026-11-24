# Demo factory foundation batch

Based on repository main 527297d1d9e4225eccce348a7cf6b38f9fb75f80. Upload every path in the batch, including new shared and test files. This batch needs no database migration or new paid provider.

## Owner export

The public designed-demo preview still works without login. The Owner ZIP control checks server-side owner access, and the export request checks again before generating the static files on the server. The existing owner guard requires authentication enabled, exactly one email in API_ALLOWED_EMAILS, and a confirmed matching Supabase account. Do not put email addresses, credentials, or service keys in source files. If the guard is not configured, export fails closed. Existing demo previews without a design recipe keep their legacy layout and do not get this ZIP action.

Public demo API output uses an explicit visible-field allowlist. This limits that API response; it does not prove database row-level security, remove private text accidentally placed in visible fields, or prevent copying public website content. Independently verify deployed Supabase grants and policies. The ZIP remains a static concept: forms are simulated, and images and fonts can depend on external services. Verify image rights and attributions before use. It is not a production backend or a self-contained asset bundle.

## Website intelligence and industry ideas

The private site map now combines bounded links found on already-read same-origin pages, without additional fetches. A link does not prove that page was read. Existing scanner limits and status labels still apply. New jobs also save category-based suggested pages for owner review. These are ideas only, not verified business facts, pages built, bookings, or production-ready industry templates. Older jobs do not acquire a plan automatically. Generated status and existing QA review semantics remain unchanged.

## Verification and rollout

Run the offline tests under tests/, server TypeScript checks, a production build and a preview deployment before merging. Two database integration tests require the explicitly isolated local PostgREST fixture and must not be pointed at production. Verify an owner and signed-out session on a new designed demo, then inspect an older demo, and review the private site map. Confirm the Vercel deployment is Ready and test the live app after merge. This repository archive is not itself a deployment.
