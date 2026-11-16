ClientRadar AI / Lead Finder code update

This ZIP contains only the changed source files, arranged by their paths from the repository root.
Extract/overlay these files into the root of the matching ClientRadar repository, allowing the files to be replaced.

Includes:
- Lead Finder website scanning and owner review before saving candidates
- Master email-present/email-missing totals from all lead records
- Shared server-side Gemini configuration for the identified AI features
- Accurate assistant status text for database-rule answers

No API key or secrets are included. Existing stage-price ranges are unchanged. Do not commit or deploy until you have reviewed and tested the changes in your own checkout.

Validation performed: npm run build passed; eight focused behavior checks passed; TypeScript reports 30 existing diagnostics (none in changed files).
