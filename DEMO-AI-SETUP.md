# ClientRadar Demo AI setup

Status: Deployment Pending. The Demo Factory has built-in text for every style level, so it works without an AI key. To switch on AI-written copy, set these server-side variables in Vercel (Project > Settings > Environment Variables), then redeploy:

```text
DEMO_AI_PROVIDER=gemini
DEMO_AI_API_KEY=server-only-key
DEMO_AI_MODEL=gemini-3.5-flash-lite
```

- Get a free key at https://aistudio.google.com/apikey (no card needed on the free tier).
- `DEMO_AI_MODEL` is optional for Gemini; the default is `gemini-3.5-flash-lite`. Google retires model names over time (`gemini-2.0-flash` was shut down in June 2026). If the queue shows "AI not used: ... HTTP 404", set `DEMO_AI_MODEL` to a current free model name shown in Google AI Studio.
- Free-tier request limits are set by Google and can change. When the limit is reached the demo still completes with built-in text and the queue shows the reason.
- `DEMO_AI_PROVIDER=openrouter` is also supported; `DEMO_AI_MODEL` is then required.
- `DEMO_AI_PROVIDER=fallback` or an absent key keeps the free built-in generator active.
- Never add these as `VITE_` variables. The API never sends provider keys to the browser.

Generated content is stored in `demo_jobs.content` and displayed at `/demos/preview/:id`. The Demos queue shows "AI written" or "built-in text" for each demo.
