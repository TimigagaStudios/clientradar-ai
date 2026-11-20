# ClientRadar product improvements - round 4

Baseline: GitHub main `034772ca2d1a39d7e1cacabd998e23835dcfe310`, the merge of website-foundation-round-3.

## What this round adds

- For newly generated demos, the existing site scan can build a small private page-link map from the starting page's already fetched HTML. It recognizes common page names and prioritizes important categories such as About, Services, Products, Pricing, Contact, Portfolio, Blog and Booking when those links are actually present.
- The map is limited to 20 entries and inspects at most 500 links. A page is marked Read only when the same URL was actually fetched by the existing scan. Otherwise it says Link found only. A link or inferred category does not establish that the page works, that its contents were analyzed or that its facts are correct.
- In Demo Tracking, open More details and actions, then Pages found on the starting page. The map is stored in existing private generation metadata and is stripped from public demo previews. Old demos do not gain a backfilled map.
- This step uses only HTML already fetched by the existing scan. It does not request extra pages, create any demo automatically or introduce a new provider or paid service. Existing Ultra Premium default, QA and separate send-approval gates are unchanged.

## Boundaries

This is an initial link map, not a full site evidence map or adaptive multipage generator. It can miss JavaScript-rendered navigation, unquoted links, query-dependent links, different origins, later links or links outside its limits. It does not check that a link is live, extract facts from unread pages, verify ownership or rights, or change the demo's fixed page structure. A partial scan remains partial. The existing website scan can read home, contact and about pages and same-site stylesheets; this round adds no additional network reads and does not add robots.txt policy enforcement to the existing scanner. Respect site restrictions and confirm rights before reusing website images or text. Automatic QA does not verify all facts, visual quality, links, security or legal compliance.

Existing demos are not regenerated, and they may show no generation scan record. New demo creation remains subject to the normal explicit approval and may use existing metered services. No SQL, migration, new environment variable, outreach or customer email is included. The new server helper starts with an underscore and the API source inventory remains at 12 non-underscore TypeScript files; the actual Vercel output count is not independently verified.

## Testing

- Node 22 Vite production build and targeted server TypeScript check passed. Whole-client TypeScript still has 17 baseline diagnostics, not a clean check.
- Seventeen offline suites passed, including page-map limit, prioritization, unsafe-link filtering, worker metadata, public-preview privacy and prior QA/send-gate tests. Database-backed integration suites were not rerun.
- Synthetic Chromium tested the disclosure and read-versus-link-only labels at widths 320, 390, 768 and 1280. Mock data and APIs were used; no customer send occurred. These are not physical-device or live production tests.

## Upload

Upload the ZIP files with their folder paths to a new branch named `website-page-map-round-4`, review the pull request and merge it into main. No SQL is needed. Verify Vercel is Production Ready for the merge commit. The new map appears only for demos generated after this round when the scan succeeds; do not regenerate an existing demo merely to test it without your explicit approval.
