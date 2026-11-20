# Showcase review workflow

Base: main 5713db27600eccc6178120838b1fb6559960de2b. Apply every path in this package together. No migration, secret, new service or automated outreach is included.

## Scope

- The existing review screen can now correct sample showcase item titles, subtitles and details using the owner's exact words. Each save requires the authenticated owner and explicit confirmation, is restricted to an existing bounded item covered by the current review, and reruns the existing QA check. It never invents facts or sends a message. Editing items does not remove the sample label or the sample-showcase finding. Owner review and the separate QA override and send approval still apply.
- Findings on a showcase title or item can be corrected directly. Automated visible-text screening also considers the business name, disclaimer and showcase heading for existing categories of possible claims and placeholders. These are prompts to review, not factual judgments, and do not verify every claim or find every possible problem. The text inspection is bounded to 200 fields, with up to 4000 characters per field and up to 30 items per array, so unusually large content may not be fully screened.
- Prior QA version 2 and earlier results intentionally show as stale under version 3: recheck before relying on them. Checks and approved corrections may perform the existing bounded website-contact read if a saved website is present; no new provider or request type is added. A quality override is still separate from explicit approval to send. No saved demos are rewritten automatically.
- The editor captures the review fingerprint when opened, so a different-device or background update cannot silently replace the review context of an in-progress correction. The server rejects stale reviews. It also distinguishes a successful save followed by a failed refresh from a save failure, and asks before discarding unsaved text when switching fields.
- The queue describes a finished job as Generated, with a note that this does not mean approved for sharing. It does not change stored job or lead status.

## Verification and limits

27 offline suites passed, including mocked handler checks for owner approval, review matching, bounded item paths, stale fingerprints and preserving the sample finding. Targeted server TypeScript passed; full-client diagnostics matched the 17 existing baseline errors after line-number normalization. Synthetic actual-component browser checks with mocked API passed in Chromium and WebKit at 320, 390, 768 and 1280 pixels, including cancellation, unsaved-text protection and fingerprint capture. These are not physical-device, real-database, live-site or end-to-end sending tests.

A local production Vite build was not verified; require a successful Vercel branch build. Previous PR #13 matched all 13 package paths and GitHub reported Vercel deployment success, not live feature correctness. No real prospects, websites, demos, external provider calls or messages were used in this batch's tests. Website-aware generation and industry-specific pricing are still incomplete; all business details and photo rights need human verification.
