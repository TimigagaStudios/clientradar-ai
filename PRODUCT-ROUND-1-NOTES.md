# ClientRadar product improvements - round 1

Baseline: GitHub main `a7d18d6f8d2a5c93aad9a3afc99f4db472007bf8`.

## What this round changes

- Makes the Demo Factory controls wrap and shrink at laptop sizes, and lets its status filter scroll within its own space.
- Makes Demo Tracking cards more compact. Business, location, status, link availability, score, deal value, main actions and important QA status remain visible. QA details, view details, sharing and delete remain available under More details and actions. The existing demo queue and QA correction controls remain available.
- Keeps explicit external-share confirmations. A checked review with no usable issues list is now treated as unavailable, not a clean review. QA review and server-side email approval remain separate.
- Calls opens Demo Opens rather than Client Views and explains that the count can include owner and repeat visits. A missing deal value is shown as Not set. The count previously labelled Demo Leads is now Leads Tracked because it also includes leads with Not Started status.
- Makes the desktop Lead Globe canvas use the viewport dimensions and respond to resizing. The shared desktop header is hidden only on the globe route so the globe's own controls are unobstructed; the mobile header stays. The globe's search, focus, markers, grouping, reset, city links, drag and zoom logic remain in place.

## Boundaries

This is the first incremental UI round, not completion of the full product project. It does not add Website Intelligence, adaptive multipage generation, event timestamps, a comprehensive app-wide redesign or new workflow statuses. Those require further audit, implementation and testing. Existing demo statuses retain their current meanings. QA is limited screening, not assurance that facts, visuals, links, security or legal compliance are correct. External sharing opens another app; ClientRadar cannot confirm a send there.

No database changes, SQL, new service, new API function, new environment variable or production data operation is included. No customer message was sent. The Ultra Premium default is unchanged.

## Verification performed

- Production Vite build passed on Node 22. The build required a constrained-memory invocation in the test sandbox.
- Whole-client TypeScript reported 17 diagnostics, exactly matching a clean checkout of the same baseline; this is not a clean type-check.
- Twelve existing offline AI/QA/message/handler suites passed. Database-backed integration suites were not rerun in this UI-only round.
- Synthetic Chromium tested Demo Tracking at widths 320, 390, 768, 1024, 1280, 1600 and 1920. The document did not overflow in the tested states. The prior 1280px factory overflow was no longer reproduced. Compact cards, QA finding visibility, details disclosure and an external-share confirmation were exercised with synthetic data. Unchecked, stale, error, missing-result and checked QA states were tested separately. No actual send was performed.
- Actual `react-globe.gl` WebGL was exercised in headless Chromium with software rendering and mocked textures: canvas sizing, desktop resize, search, synthetic lead focus and reset passed. Drag and wheel input were exercised, but precise camera movement and all marker/group interactions were not formally verified. A separate globe stub was used for layout-size assertions.
- These tests are not physical iPhone/iPad/Mac Safari tests, do not establish live production behavior and did not exercise all app states, real map textures or external providers.

## Upload and deployment

The ZIP contains only this new note and the three changed source files at their repository-relative paths. Upload them to a new branch, not directly to main. Review the pull request and checks before merging. No SQL is needed for this round. A successful merge is not proof of deployment: verify the Vercel production deployment is Ready at the new merge commit, then inspect Demo Tracking and the globe on your own devices. Avoid sending test emails to customers.
