# ClientRadar product improvements - round 3

Baseline: GitHub main `7b2d602b22766da7da2e2998d7b53a54f436a1fe`, the merge of product-activity-round-2. All 15 round 2 files were verified against that merge. Vercel production deployment was not independently verified.

## Website-reading foundation

- The existing lead/demo website scanner and the separate QA home-page reader use a shared bounded network helper. Each hop resolves and vets public IPv4 addresses, rejects private/reserved destinations, and pins the connection to a vetted address while keeping the site hostname for TLS. Redirects are limited, checked at every hop and restricted to the original host or its `www` equivalent. HTTPS is never downgraded. Credentials, nonstandard ports, URL queries and fragments are not sent. The scanner supports ordinary HTTP or HTTPS; the QA reader requires HTTPS.
- Requests have time, body-size and content-type limits. Compressed responses are not accepted. Only same-site stylesheets are read. Some legitimate sites, redirects, IPv6-only sites, query-dependent pages, CDN stylesheets or compressed responses may therefore be unavailable or only partially read. These restrictions are intentional and can change scanner results compared with earlier versions.
- The QA home-page cap is now 512 KiB rather than 128 KiB, and safe same-site `www` redirects are allowed. In a local test, the public Horita home page returned available through this reader. This does not establish what the production deployment will return or prove that the business details are correct.
- The generation prompt now distinguishes a supplied but unreadable website from no supplied website; neither is treated as proof the business has no website. Extracted website details are identified as untrusted, partial data. Older queued standard prompts have their old misleading website-status wording normalized when processed.
- Newly generated shared-worker demos privately record whether generation used a partial website scan, an unavailable site or no supplied address. Open More details on Demo Tracking to see this; older demos have no such generation scan record. The public preview API strips this private metadata. QA's separate home-page contact check still has its own status and remains a limited check.
- The scan summary no longer claims a site is not built for phones merely because a viewport tag was not detected.

## Important limits

This is a foundation, not full Website Intelligence. The scanner still reads the home page and up to one contact and one about page, plus up to three same-site stylesheets. It does not build a comprehensive evidence map, adapt the renderer to all discovered page types, validate every fact or every link, or visually test a generated site. It does not execute JavaScript, submit forms or bypass access restrictions. Website text is untrusted; prompt instructions and automatic screening cannot guarantee that generated claims are correct. Review demos and verify facts before sharing. Existing image selection behavior is unchanged: a publicly visible business image is not proof that its reuse is licensed or authorized. Confirm rights before using third-party images.

No SQL, data migration, new environment variable, paid service or new non-underscore API function is included. No customer email was sent. Existing approval and QA gates remain separate. Some provider calls and other existing services may have usage costs; they are not assumed free. The `api/` source inventory remains 12 non-underscore TypeScript files by the existing counting method; actual Vercel output count has not been independently checked.

## Verification

- Node 22 Vite production build passed. Targeted server TypeScript check passed. Whole-client TypeScript retained 17 baseline errors; it was not a clean type-check.
- Sixteen offline tests passed, including simulated DNS, rebinding/pinning, redirect, private-address, response-size, content-type, credential and public-preview privacy checks. Database-backed integration tests were not rerun.
- Synthetic Chromium tested the website-analysis states and QA warning on Demo Tracking at 320, 390, 768 and 1280 widths. No document overflow or page errors were observed in those mocked states. This is not physical-device or production testing.
- The separate local Horita test contacted only the public home page; it did not send email or submit a form. It does not prove a full site analysis, source rights, business facts, or live Vercel behavior.

## Upload and verify

Upload the ZIP files with their folder paths to a new branch named `website-foundation-round-3`, then review and merge the pull request into `main`. No SQL is needed. Confirm Vercel shows Production Ready for the merge commit.

After deployment, you can recheck the existing Horita demo in Demo Tracking and inspect the QA website-contact status. Rechecking is a website read and QA record update, not an email send; it may still report unavailable if the deployed environment or site response differs. Older demos will say no generation scan record because their history was not invented. Creating a new demo requires your normal approval and may use existing paid or metered services.
