# ClientRadar round 6 - private page-source notes

Baseline: GitHub main 257284da35871d4ed36672edc0c0c59257edaee5 (PR #8).

## What this adds

For newly generated demo jobs, the existing scan now saves a limited source record for each of up to three successful page reads: the actual final host and path, the page title and first heading when detected, and up to three possible emails and phone numbers found in page text. It discards query strings, omits very long paths and avoids script, style, SVG, noscript, template, iframe and HTML comment blocks for this source record. Duplicate final page addresses are listed once. A page that could not be read does not acquire a source record.

Open Demo Tracking, expand the demo's details and then open Details found on pages read. These are private owner review notes, not facts verified by the app or proof of image or text reuse rights. They are not inserted into the AI prompt and are stripped from the public demo API response. The existing homepage website profile still supplies design cues to the generator as before, and existing contact-fill behavior is unchanged. Previously generated demos are not backfilled or regenerated. A QA recheck does not add a source record.

## Limits

This is not a full evidence map. It only summarizes up to three pages already read by the scanner, typically the starting page and at most one contact and one about page; no additional page requests or providers were added. It can miss dynamically rendered material, contact details present only in links, extra headings, page content after size limits, and pages whose final address is unsupported. A page's text can be hidden, misleading, stale or incorrectly extracted; contacts can be formatted differently, so verify them with the source and the business before sharing. Page titles and headings do not establish what a demo actually used or that a claim is true. Some scan-derived home cues and contacts were used by the existing generation flow; these source notes are not a sentence-by-sentence audit trail.

The existing scan's robots/access-policy limitations are unchanged. Prioritized additional page reading, robots handling, adaptive multipage generation, comprehensive link checking, image permission workflows, visual QA and full source-to-claim traceability remain future work. Website-sourced images remain disabled for new photos under round 5; existing images are not removed. No SQL, new environment variables, new paid services, emails or automatic demo creation are included.

## Testing and upload

- Nineteen offline Node 22 suites passed, including tests for actual read versus link-only, source path mapping, sensitive query exclusion, hidden blocks, no extra network requests, demo worker metadata and public response privacy. API TypeScript passed; full-client TypeScript matches the existing 17 diagnostics and is not clean.
- Mocked Chromium with compiled project CSS tested the disclosure at widths 320, 390, 768 and 1280, including long untrusted text rendered as text, no horizontal overflow and no writes. No real database, physical device, provider or production feature test was performed. Database-backed suites were not rerun.
- Local Node 22 production build was killed by the sandbox with exit 137 after transforming modules, so this package is review-ready, not locally build-verified. Upload to a new branch, open a pull request and wait for its Vercel preview build to succeed before merging. If it fails, stop and share the error. Verify the production deployment for the merge afterward.

Upload all ZIP paths exactly where listed: root notes; three files in api/lib; two files in src; and the test files in tests. No migration or environment changes are needed.
