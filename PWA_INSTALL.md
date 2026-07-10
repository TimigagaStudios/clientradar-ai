# ClientRadar AI â€“ PWA Install (V2.5 Revenue Mode)

3 files were added to `/public`:
- `manifest.webmanifest`
- `sw.js`
- `icons/icon-192.png`, `icon-512.png`, `maskable-icon-512.png`, `apple-touch-icon.png`

1 helper:
- `src/pwa-register.ts`

---

### 1. Register the service worker

In `src/main.tsx`, add as the first import:
```ts
import './pwa-register'
```

That's it â€“ rest of your main.tsx stays unchanged.

### 2. Add PWA tags to `index.html` <head>

Add these inside `<head>`, before your main CSS:

```html
<meta name="theme-color" content="#ff8a2b" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="ClientRadar" />

<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

<!-- iOS splash â€“ optional, uses the same icon -->
<link rel="apple-touch-startup-image" href="/icons/icon-512.png" />
```

Ensure your existing `<meta charset="UTF-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1">` are present â€“ this fixes the â‚¬ / Ã¢â‚¬â€ mojibake issues.

### 3. Build / Deploy

```
npm run build
# vercel --prod
```

First load registers the SW. Second load is cached offline.

### 4. Install

- **Android / Chrome**: address bar â†’ "Install ClientRadar"
- **iOS Safari**: Share button â†’ "Add to Home Screen"
- **Desktop Chrome/Edge**: address bar install icon

App launches standalone, no browser chrome, with your orange radar icon.

---

### Optional: Add an Install button in the UI

```ts
import { canInstallPWA, promptInstallPWA } from '@/pwa-register'

// in a settings/about component:
if (canInstallPWA()) {
  await promptInstallPWA()
}
```

iOS doesn't support programmatic install â€“ users must use Share â†’ Add to Home Screen (show a small tip banner if you want).

---

Cache version is `clientradar-v2-5-1` in `public/sw.js` â€“ bump that string when you ship a big update to force clients to refresh.