# ClientRadar round 5 - image-rights safeguard

Baseline: GitHub main 1e153a4760ec91ebc46dd35b284e92df9a8668e0, after PR #7.

## Changes

- New demo builds no longer automatically use images discovered on a lead's website. The website scan can still gather design cues and contacts, but image discovery does not establish ownership or permission to reuse an image.
- New photos can come from the existing configured Unsplash or Pexels integrations and continue to be marked as samples. If no provider returns a photo, the demo uses its existing designed artwork. This change adds no provider, paid service, environment variable or schema change. Provider use can still have its existing costs, limits and terms. A sample label does not itself prove a license covers a particular use.
- Refreshing a demo adds only sample provider photos and no longer fetches a website specifically for photos. Already stored photos are not deleted or replaced. No permission-grant or image-upload workflow is introduced in this round.
- Demo recheck flags stored photos that are not labelled sample for owner rights review. Older checks of affected demos are marked stale until rechecked. When an outreach message links a recognized ClientRadar demo, the send review also displays this warning for non-sample photos even if the old review is unchecked or stale. Existing QA override and separate explicit send approval still apply. Previously issued review tokens are invalidated by the review rule version change.

## Important limits

Existing demos and direct public preview links still show their saved photos; this change does not remove, hide, revoke or retroactively authorize them. Review those images and avoid sharing them unless rights are established. The automated warning relies on the stored photo label: a mislabeled sample, assets outside the photos array, provider license limits, embedded third-party assets and direct sharing outside the reviewed outreach flows are not reliably detected. The app does not verify licenses, automatically obtain permission, or certify the legal status of any image. Verify provider terms and usage rights yourself.

This is an image-rights safeguard only. It does not add extra page reads, a detailed website evidence map, adaptive multipage demo generation, visual QA, full site-link checking or robots policy. No demo is created or email sent by installing it. Approval, tier defaults and existing integrations remain in place.

## Tests and deployment caution

18 offline Node 22 suites passed, including mocked photo providers, photo refresh, QA, stale legacy reviews and outreach review gates. Targeted API TypeScript passed. Database-backed integration suites and physical-device/production tests were not run. No client source is changed, but a local Node 22 Vite production build was attempted twice and the sandbox killed it with exit 137 after transforming modules; a successful full build was not obtained in this environment. The preceding round's Node 22 build had passed; that does not prove this new deployment builds.

Upload the changed files using their exact repository paths to a new branch and open a pull request. Check that the Vercel preview build for the pull request succeeds before merging. If it fails, do not merge; share the error. After a successful preview and merge, verify the production deployment is Ready for that merge. No SQL is required. Existing review tokens may require a fresh QA review and separate send confirmation.
