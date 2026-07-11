## 1. PROJECT OVERVIEW

**Project name:** Subora  
**Project purpose:** A fintech-grade, mobile-first “banking app” style web app that combines:
- Multi-account wallet/dashboard (multiple banks/cards → unified + individual balances)
- Subscription tracking (auto-tracking later; UI + structure now)
- Transactions + payments hub (UI placeholders now; logic later)
- App-like experience (splash, onboarding, auth, loading transitions)

**Main goals (current spec):**
- Banking-quality UI identical in finish to provided references (stacked card wheel + dashboard layout)
- Mobile-first with bottom navigation (banking app feel)
- Dark + light mode
- React Router navigation (real URLs)
- Backend-ready structure (Supabase prepared; service layer planned)

**Current version:** Early MVP UI iteration (pre-backend logic)  
**Development status (% completed):** ~35%  
- UI foundation exists (layout, dashboard modules, wallet/cards views)
- Card wheel is close but not final
- Router/auth/onboarding/splash not fully completed as final flow yet
- Backend (Supabase DB/RLS) not built yet

**Current stage of development:** UI-first + app-shell restructuring + performance tuning (card carousel)

**Major milestones completed:**
- Vite + React + Tailwind v4 setup running on Vercel
- Core screens exist: Dashboard, Wallet, Cards, Payments, Transactions, Analytics, Calendar
- Theme tokens via CSS variables with `.light` toggle
- React Router added to dependencies (in preparation for URL routing)
- Stacked card wheel component created and iterated (now closer to “wheel skip” behavior)
- Accent color decision changed to **Orange (#FE805D) in both modes**

**Remaining milestones:**
- Finalize stacked “wheel-roll” card carousel to match reference exactly (no blur per latest request)
- Convert navigation to true React Router routes (remove internal `activePage` switching OR bridge it cleanly)
- Implement splash screen + onboarding + login/signup flow (app-like)
- Add bottom navigation bar (4 icons as per spec)
- Add loading transitions between pages
- Add backend-ready service layer + Supabase auth session integration
- Add subscription tracker DB + UI + calendar timeline integration
- Add transactions + accounts linking mock APIs → later real integrations

---

## 2. COMPLETE PROJECT HISTORY

> Note: This history is reconstructed from the conversation + pasted code + Vercel build logs. Exact commit-by-commit chronology may differ; verify in GitHub commits.

### Initial state (observed)
- Project is **Vite** (not Next.js), with:
  - `src/App.tsx`, `src/main.tsx`, `src/index.css`
  - `src/components/*` views: `Dashboard.tsx`, `Wallet.tsx`, `Cards.tsx`, `Analytics.tsx`, `Calendar.tsx`, `Payments.tsx`, `Transactions.tsx`, `Layout.tsx`
  - `src/components/ui/index.tsx` (UI primitives)
  - `src/lib/mock.ts`, `src/lib/supabase.ts`
  - `src/utils/cn.ts`
- Navigation originally implemented as **internal state routing**:
  - `App.tsx` used `activePage` state + `renderContent()` switch.
  - `Layout.tsx` sidebar/menu used `setActivePage()` to swap views.
- Theme system:
  - CSS variables in `index.css`
  - `.light` class toggled by `Layout.tsx` button

### Major changes added/modified during this chat
1) **Routing direction change (React Router)**
   - Added `react-router-dom` to `package.json` to support URL routing.
   - Attempted to move from `activePage` → React Router routes.
   - Not fully confirmed as merged in repo at the end; dependency exists.

2) **Card carousel “wheel” introduction**
   - Added new card UI approach (stacked deck/wheel) with Framer Motion:
     - `src/components/cards/CardWheel.tsx`
     - `src/components/cards/FintechCard.tsx`
     - `src/lib/walletCards.ts`
   - Iterated multiple times:
     - Initial stack with heavy blur + heavy shadows (laggy on iOS Safari)
     - Performance tuning: reduced render count, removed huge glows, added `touchAction`
     - Added infinite/loop behavior (wrap index)
     - Changed layout from “fan arc” to “reference-like” stack: active + 2 behind top-right
     - Implemented “skip to next card” swipe thresholds (offset/velocity based)

3) **Theme changes**
   - Original Subora spec required neon green accent (#00FF99).
   - User later explicitly required **Orange accent (#FE805D) for both dark and light**.
   - `src/index.css` was updated to use CSS variables `--accent` and set it to orange in both modes.
   - Light mode background updated to match the provided palette (`#E7F1F9` etc).

4) **Bug fixes from Vercel logs**
   - Build failure: missing `react-router-dom` after code imported it → fixed by adding dependency.
   - Build failure: missing `src/lib/walletCards.ts` referenced by `Cards.tsx` → created/added file.
   - PWA attempt introduced dependency conflict:
     - `vite-plugin-pwa@0.21.2` does not support `vite@7.2.4` (peer dependency conflict) → installation failed on Vercel.
     - Resolution: do NOT use the plugin on Vite 7; use manual manifest + iOS meta tags approach instead.

5) **Performance improvements**
   - Removed/limited `filter: blur()` and large glows on moving elements (iOS performance).
   - Reduced number of rendered cards in carousel to 3 (active + 2 behind).
   - Added `touchAction: "pan-y"` to enable smooth horizontal dragging on mobile Safari.

### Features removed
- None explicitly removed; changes were additive/iterative.

### Architecture changes
- Planned architecture change: move from internal page switching to React Router routes.
- Not fully confirmed completed in repo; dependency is present.

### Database/API changes
- No DB schema changes implemented yet.
- Supabase client exists; auth and DB usage not implemented in core flows yet.

---

## 3. CURRENT PROJECT STATE

### What works
- App builds and deploys on Vercel (when dependency issues resolved).
- Theme toggle works via `.light` class approach.
- Dashboard UI modules render (stats, charts, lists) using existing components.
- Wallet view renders with action buttons + activities list.
- Cards page renders card detail layouts.
- Card carousel/stacked wheel exists and is “closer” to reference than before.

### What is partially complete
- **Card wheel effect**: closer but not identical to the reference yet.
  - User’s latest request: **remove blur** but keep depth/fade.
- React Router integration:
  - `react-router-dom` dependency exists.
  - Actual route-based navigation is not fully verified as final state in the repo (some files were proposed; user’s original `App.tsx` still uses `activePage` switching).
- PWA “install like an app”:
  - Plugin approach failed due to Vite 7 compatibility.
  - Manual manifest method proposed but not confirmed implemented yet.

### What is not yet built
- Splash screen (animated logo) + timed redirect.
- Onboarding slides (4 screens) with Framer Motion.
- Proper Auth flow (login/signup pages integrated into routing + Supabase session).
- Bottom navigation bar (Home/Cards/Transactions/Settings) as final navigation.
- Unified bank linking logic + service layer stubs (Open Banking / card linking / plaid-like architecture).
- Subscription auto-tracking logic + DB tables.
- Transactions service + DB tables + filtering/search.
- Payment flows beyond placeholders.

### Known bugs / issues (observed)
- Vercel dependency conflicts occur if incompatible packages are added (PWA plugin conflict).
- Carousel performance can degrade on iOS if blur/shadow/glow effects are too heavy.
- Some styling mismatches vs reference (spacing, background plate, placement of back cards, exact fade levels).
- Router migration may introduce refresh 404 on Vercel unless SPA rewrites are configured (if/when BrowserRouter routes are used).

### Known limitations
- No real backend logic yet (mostly mock data).
- App behavior not fully “native-like” without splash/onboarding + PWA manifest.
- No persistent user state beyond local toggles.

### Pending improvements
- Remove blur in wheel while keeping depth via opacity + grayscale + scale + overlay.
- Finalize exact reference layout for Wallet/Dashboard (greeting row, icons, action buttons, recent tx list).
- Standardize card gradient rules per spec (dark: #1A1A1A → #2B2B2B; light: #F5F5F5 → #E9E9E9) while still allowing variants.
- Implement bottom nav + page transitions (loading states).

---

## 4. FULL FILE STRUCTURE

> This tree includes everything **confirmed from screenshots/pastes** plus **new files added during this chat**.  
> If anything is missing, verify in GitHub “Code” tab (phone) under `/src` and `/public`.

```txt
subora-fintech/
├── index.html
├── package.json
├── package-lock.json                    (exists in repo per Vercel logs)
├── tsconfig.json
├── vite.config.ts
├── vercel.json                          (NOT confirmed added; needed if Router refresh issues)
├── public/
│   ├── (pwa icons not confirmed yet)
│   ├── pwa-192.png                      (planned/manual PWA)
│   ├── pwa-512.png                      (planned/manual PWA)
│   └── manifest.webmanifest             (planned/manual PWA)
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── components/
    │   ├── ui/
    │   │   └── index.tsx
    │   ├── Analytics.tsx
    │   ├── Calendar.tsx
    │   ├── Cards.tsx
    │   ├── Dashboard.tsx
    │   ├── Layout.tsx
    │   ├── Payments.tsx
    │   ├── Transactions.tsx
    │   ├── Wallet.tsx
    │   └── cards/
    │       ├── CardWheel.tsx
    │       └── FintechCard.tsx
    ├── lib/
    │   ├── mock.ts
    │   ├── supabase.ts
    │   └── walletCards.ts
    └── utils/
        └── cn.ts
```

---

## 5. GITHUB REPOSITORY DETAILS

**Repository name:** `TimigagaStudios/subora-fintech`  
**Branches:** `main` (others not confirmed)  
**Current branch:** `main`  
**Important commits (from logs):**
- `44907c9` (earlier deployment)
- `baf4132` (deployment where walletCards import error surfaced)
- `5d112a2` (deployment where PWA plugin caused Vite peer dep conflict)

**Deployment status:** Deployed on **Vercel** (production preview link used on iPhone).  
**CI/CD setup:** Vercel builds on push to GitHub:
- Runs `npm install`
- Runs `npm run build` (Vite build)

**Environment variables required:**
- Supabase (likely needed when auth/db is enabled):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
(Values must be set in Vercel project settings; not stored in repo.)

**Secrets configuration:**
- Supabase keys must be set in Vercel Environment Variables (Production/Preview).
- No other secrets confirmed.

---

## 6. FRONTEND DETAILS

**Framework:** Vite + React (React 19)  
**Libraries used:**
- TailwindCSS v4 (via `@tailwindcss/vite`)
- Framer Motion (animations)
- lucide-react (icons)
- recharts (charts)
- clsx + tailwind-merge (class composition)
- react-router-dom (installed; routing migration in progress)
- Supabase JS client (installed; backend integration not finalized)
- date-fns (dates)

**Key components created/used:**
- `components/Layout.tsx`: Banking dashboard shell with sidebar/header; toggles `.light`
- `components/Dashboard.tsx`: Dashboard modules (stats, chart, subscription rows, etc.)
- `components/Wallet.tsx`: Wallet view with card section + quick actions + activities
- `components/Cards.tsx`: Card management page with detailed card blocks
- `components/cards/CardWheel.tsx`: Stacked wheel carousel (iterated heavily)
- `components/cards/FintechCard.tsx`: Minimal premium card UI (black/white)
- `components/ui/index.tsx`: Button/Card/Badge/Input primitives (existing)
- `utils/cn.ts`: className helper

**Pages created:**
- Not separated into `/pages` directory; “pages” are view components.

**Routing structure (current):**
- Originally: internal `activePage` state in `App.tsx` + `Layout` triggers.
- Migration path: React Router intended (dependency installed), but final integration not fully verified.

**State management:**
- Currently: React `useState` inside `App.tsx` + per-component local state.
- Requirement: Context or Zustand (not yet implemented).

**Styling system:**
- Tailwind v4 + CSS variables defined in `index.css`
- Theme tokens in `@theme` block map to Tailwind colors:
  - `bg-background`, `text-text-primary`, `bg-secondary-background`, `text-accent`, etc.

**Theme system:**
- `.light` class on `<html>` toggled by Layout’s theme button.
- Tokens:
  - Dark: background near `#0B0B0B`, secondary `#111111`, text white
  - Light: `#E7F1F9`, secondary translucent white, text `#26344F`
  - Accent: `#FE805D` in both modes (current decision)

**Responsive design:**
- Mobile-first layouts with Tailwind responsive modifiers.
- Sidebar hidden on mobile; mobile menu overlay present.

---

## 7. BACKEND DETAILS

**Backend framework:** None (frontend-only Vite app).  
**APIs:** None implemented yet (future).  
**Authentication system:** Not implemented fully; Supabase client exists but auth flow not wired end-to-end.  
**Middleware:** None.  
**Services:** Not implemented yet; planned “bank connectors/service layer”.

**Database connections:**
- Supabase client file exists: `src/lib/supabase.ts`

**Server configuration:**
- Vercel static hosting of Vite build.

---

## 8. DATABASE DETAILS

**Database type:** Supabase Postgres (planned/partially prepared)  
**Tables / schema:** Not created yet in this workstream (no SQL migrations provided).  
**Relationships / indexes / migrations:** Not implemented yet.

Planned tables (based on spec; not built yet):
- `profiles` (user profile)
- `accounts` (linked bank accounts/cards)
- `subscriptions` (name, amount, cycle, next_charge, category, payment_method_id)
- `transactions`
- `payment_methods`
- `categories`

---

## 9. FEATURES INVENTORY

### Completed Features
- [x] Vite + React + Tailwind + Framer Motion project running
- [x] Core screens exist (Dashboard/Wallet/Cards/Transactions/Payments/Analytics/Calendar)
- [x] Theme toggle with `.light` class + CSS variables
- [x] Stacked card carousel exists and is near the reference behavior
- [x] Orange accent applied to both modes

### In Progress Features
- [ ] Card wheel: remove blur, keep depth, match reference precisely
- [ ] Navigation refactor: internal `activePage` → React Router routes
- [ ] “App-like” packaging: manual PWA manifest + iOS add-to-home-screen support

### Planned Features
- [ ] Splash screen animation + redirect
- [ ] Onboarding screens (4 slides)
- [ ] Login/Register with Supabase
- [ ] Bottom navigation bar (Home/Cards/Transactions/Settings)
- [ ] Subscription auto-tracking + calendar timeline
- [ ] Multi-account linking + unified balance logic
- [ ] Payments flows (airtime, bills, giftcards, crypto exchange) UI then logic
- [ ] Analytics insights + charts

---

## 10. UI/UX INVENTORY

**Screens (existing):**
- Dashboard (banking-style overview)
- Wallet (card deck, quick actions, activities)
- Cards (card detail blocks + actions)
- Transactions (placeholder view exists)
- Payments (placeholder view exists)
- Analytics (charts exist)
- Calendar (subscription calendar view exists)

**Navigation structure (current):**
- Desktop: sidebar items in Layout
- Mobile: hamburger menu overlay (not final bottom nav yet)

**Core UI sections:**
- Greeting + actions (Dashboard)
- Card section (Wallet / Cards)
- Quick actions grid
- Recent transactions list
- Charts & insights (Analytics/Dashboard)

**Animations/effects:**
- Framer Motion used for hover/drag animations and card wheel.
- Some motion in dashboard elements.

**Typography:**
- Inter font
- Bold headings; fintech style

**Colors/design system:**
- CSS variables + Tailwind theme mapping
- Accent: Orange `#FE805D`
- Dark: near-black with subtle contrast
- Light: `#E7F1F9` palette

---

## 11. THIRD-PARTY SERVICES

- **Supabase** (`@supabase/supabase-js`) — auth + DB (planned integration)
- **Vercel** — hosting + CI builds
- No payments provider integrated yet (planned)

---

## 12. CONFIGURATION DETAILS

**Environment setup:**
- Node/npm
- Vite build

**Commands:**
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

**Deployment:**
- Push to GitHub → Vercel builds automatically.

**Dependencies (current):**
- `react`, `react-dom`
- `tailwindcss`, `@tailwindcss/vite`
- `framer-motion`
- `lucide-react`
- `recharts`
- `react-router-dom` (installed)
- `@supabase/supabase-js`
- `clsx`, `tailwind-merge`, `date-fns`

**PWA configuration status:**
- `vite-plugin-pwa` attempt FAILED due to Vite 7 peer dependency.
- Manual PWA approach recommended (manifest + meta tags + icons), not confirmed implemented.

---

## 13. KNOWN ISSUES

1) **PWA plugin install fails on Vercel**
   - Error: `vite-plugin-pwa@0.21.2` peer depends on Vite <=6, but project uses Vite 7.2.4.
   - Fix: don’t use plugin; use manual manifest OR downgrade Vite.

2) **Card wheel not identical to reference yet**
   - Positioning and depth still need tuning.
   - User now requests **no blur**; must simulate depth via opacity + grayscale + overlay.

3) **Lag/jank risk on iOS**
   - Heavy blur/shadow/glow during animations causes lag.
   - Must keep effects minimal.

4) **Router migration incomplete/uncertain**
   - Dependency added; full route integration not confirmed as final.
   - Needs careful refactor to not break Layout navigation.

5) **Potential Vercel refresh 404 (if BrowserRouter routes are used)**
   - Needs `vercel.json` rewrite if route-based navigation is enabled.

---

## 14. FUTURE ROADMAP

### Immediate next tasks (next 1–3 steps)
1) **Card wheel: remove blur** but keep “faded behind” using:
   - lower opacity
   - slight scale down
   - desaturation overlay
   - soft shadow
2) Adjust **FintechCard** to match spec gradients exactly:
   - Dark: `#1A1A1A → #2B2B2B`
   - Light: `#F5F5F5 → #E9E9E9`
   - Add subtle glass (`backdrop-filter: blur(16px)`) where appropriate without lag
3) Implement **manual PWA**:
   - `public/manifest.webmanifest`
   - icons
   - `index.html` iOS meta tags

### Short-term roadmap (1–2 weeks)
- Convert navigation to **React Router** with real routes.
- Build bottom nav bar.
- Add splash screen + onboarding slides.
- Add loading overlay transitions.

### Mid-term roadmap (2–6 weeks)
- Supabase Auth integration (login/signup, session, protected routes).
- Database tables for accounts/subscriptions/transactions.
- Subscription timeline + calendar + reminders.

### Long-term roadmap (6+ weeks)
- Real payment services integration (airtime/electricity/etc).
- Multi-bank linking provider (Open Banking style).
- “Unified balance” engine + analytics insights.
- Mobile packaging via Capacitor or RN WebView.

---

## 15. CURRENT WORKING CONTEXT

**Most recent work:**  
Improving the **stacked card wheel** to match the reference and reduce lag. The latest wheel uses:
- Active card front
- 2 cards behind stacked to top-right
- Drag/swipe triggers “skip” to next/prev

**Why:**  
The card wheel is the core identity of Subora and must match the fintech reference.

**What remains:**
- Remove blur (latest request)
- Fine-tune depth/fade and placement to look identical to reference
- Continue app-shell work: true routing + bottom nav + splash/onboarding

**What the next AI should continue from:**
- Start with the current `CardWheel.tsx` and modify it to remove blur while keeping depth.
- Then implement manual PWA assets (manifest + meta tags).

---

## 16. AI INSTRUCTIONS FOR NEW CHAT

### START HERE IN NEW CHAT

**Project summary:**  
Subora is a Vite+React fintech-style banking dashboard with wallet cards, subscription tracking, payments UI placeholders, analytics, and a premium app-like UI. The key identity feature is a stacked “wheel” card carousel that must match provided reference images.

**Current objectives:**
1) Finalize card wheel to match reference exactly (latest request: no blur).
2) Keep UI minimal/clean black & white with orange accent (#FE805D) in both modes.
3) Add app-like install behavior via manual PWA (manifest + iOS meta tags) because plugin conflicts with Vite 7.
4) Migrate navigation to React Router + bottom nav + splash/onboarding.

**Current blockers:**
- `vite-plugin-pwa` cannot be used with Vite 7 due to peer dependency conflict (Vercel build fails).
- Card wheel still not identical; effects must be tuned without heavy blur/shadows.

**Current files being edited (most important):**
- `src/components/cards/CardWheel.tsx` (carousel behavior and stacking)
- `src/components/cards/FintechCard.tsx` (card gradients + layout)
- `src/index.css` (theme tokens + accent color)
- `index.html` (for manual PWA meta tags) — not yet confirmed
- `public/manifest.webmanifest` and `public/pwa-*.png` — not yet confirmed

**Next tasks (do in order):**
1) Update `CardWheel.tsx`: remove `filter: blur(...)` and replace with:
   - `opacity` drop
   - `scale` drop
   - `saturate(0)` or grayscale overlay on back cards
   - subtle y/x offset & rotation
2) Update `FintechCard.tsx` to match exact spec gradients and text positions.
3) Add manual PWA:
   - `public/manifest.webmanifest`
   - icons
   - add `<meta name="apple-mobile-web-app-capable" content="yes">` and manifest link in `index.html`

**Exact continuation instruction:**  
“Open current `src/components/cards/CardWheel.tsx` and remove blur while preserving depth and the ‘top-right stacked’ look. Keep performance smooth on iOS Safari. Then implement manual PWA (manifest + iOS meta tags) without adding incompatible plugins.”

---

## 17. MASTER PROJECT MEMORY

**Core requirements & constraints**
- Must use: Vite + React + TailwindCSS + Framer Motion + React Router
- Must be mobile-first and feel like a native banking app
- Must include dark + light mode
- Must include bottom nav (4 icons: Home, Cards, Transactions, Settings)
- Must have splash screen + onboarding + auth pages + loading transitions
- Must be backend-ready for Supabase + future fintech services

**UI identity decisions**
- Primary UX identity: stacked card wheel/carousel like Apple Wallet/Revolut references
- Latest chosen accent: **Orange #FE805D for both dark and light**
- Light mode palette: BG `#E7F1F9`, Text `#26344F`, Secondary `#7B8387`
- Dark mode palette: near-black base; keep shadows minimal (no heavy black shadows)

**Card wheel behavior decisions**
- Render only 3 cards (active + 2 behind) for performance and reference accuracy
- Swipe/drag triggers “skip” to next/prev card (velocity/offset thresholds)
- Infinite/looping wrap index supported
- Avoid heavy blur/glow due to iOS lag; user now wants no blur

**Theme system**
- CSS variables in `src/index.css`
- `.light` class toggled on `<html>` by Layout component

**Architecture decisions**
- Current codebase originally used internal `activePage` switching.
- React Router is installed; migration is planned/ongoing.
- Supabase client exists but DB/auth not wired.

**Coding standards**
- Components are in `src/components`
- Reusable card components live in `src/components/cards`
- Mock data in `src/lib/*`
- Keep changes incremental and avoid breaking existing Vercel deployment

**Deployment & tooling**
- Hosted on Vercel; builds on push
- Avoid dependencies incompatible with Vite 7 (notably `vite-plugin-pwa@0.21.2`)
- For “app install”, prefer manual PWA (manifest + iOS meta tags) unless Vite is downgraded or a compatible plugin version is verified.

---
