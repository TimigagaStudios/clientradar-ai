# ClientRadar Demo AI setup

Status: Deployment Pending. The Demo Factory has a deterministic fallback, so it works without an AI key. To activate provider-generated copy, set these server-side variables in Vercel:

```text
DEMO_AI_PROVIDER=gemini
DEMO_AI_API_KEY=server-only-key
DEMO_AI_MODEL=gemini-2.0-flash
```

`DEMO_AI_PROVIDER=fallback` or an absent key keeps the free deterministic generator active.

The API never sends provider keys to the browser. Generated content is stored in `demo_jobs.content` and displayed at `/demos/preview/:id`.
