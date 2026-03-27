# CLAUDE.md — Artisanal Brew React

This file documents the codebase structure, conventions, and workflows for AI assistants working on this project.

---

## Project Overview

**Artisanal Brew** is a specialty coffee brewing tracker built with React + TypeScript. Users can:
- Manage a bean cellar (add/edit beans with AI-powered image scanning)
- Log and time brew sessions with guided step-by-step workflows
- Rate brews with taste tags and receive AI-powered optimization suggestions
- View analytics and charts across their brew history
- Save and browse brew recipes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 (TypeScript/TSX) |
| Build Tool | Vite 8 |
| CSS | Tailwind CSS v4 + custom theme tokens |
| Router | React Router v7 (BrowserRouter) |
| Backend | Supabase (PostgreSQL + Auth) |
| AI | Google Gemini 2.5 Flash (text + vision) |
| Tests | Vitest + React Testing Library |
| Deployment | Vercel (serverless functions + SPA rewrite) |
| Fonts/Icons | Google Fonts (Noto Serif, Manrope) + Material Symbols Outlined |

---

## Directory Structure

```
artisanal-brew-react/
├── api/                        # Vercel serverless functions
│   ├── gemini.js               # Text AI endpoint (Gemini 2.5 Flash)
│   └── gemini-image.js         # Vision/OCR endpoint for bean bag images
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/                 # Static images (hero.png, etc.)
│   ├── components/
│   │   ├── Layout.tsx          # Shared app shell: sidebar + top bar
│   │   ├── ui/
│   │   │   └── Stars.tsx       # Star rating display component
│   │   └── beans/
│   │       ├── BeanCard.tsx    # Bean cellar card with stock indicator
│   │       └── BeanDetailModal.tsx  # Bean detail overlay with brew action
│   ├── context/
│   │   └── AppContext.tsx      # Global React Context (auth, data, utilities)
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client initialization
│   │   ├── appData.ts          # Core data layer: CRUD ops, mappers, stats
│   │   ├── analyzeBean.ts      # AI bean image analysis logic
│   │   └── aiBrewAssist.ts     # AI brew suggestions and grind assistance
│   ├── pages/
│   │   ├── Login.tsx           # Auth (Google OAuth + demo mode)
│   │   ├── Dashboard.tsx       # Home: active bean, recent brews, insights
│   │   ├── Beans.tsx           # Bean cellar: add/edit/delete + AI scan
│   │   ├── BrewSetup.tsx       # New brew form (dose, water, grind, method)
│   │   ├── GuidedBrew.tsx      # Step-by-step brew timer with phases
│   │   ├── TasteAnalysis.tsx   # Post-brew rating, taste tags, AI sommelier
│   │   ├── Analytics.tsx       # Stats, SVG charts, brew history
│   │   ├── Recipes.tsx         # Browse/generate brew recipes
│   │   └── Settings.tsx        # Export data, reset, preferences
│   ├── types/
│   │   ├── bean.ts             # Bean and BeanDbRow interfaces
│   │   ├── brew.ts             # Brew, BrewDbRow, BrewStats, BrewPhase interfaces
│   │   ├── context.ts          # AppContextValue interface
│   │   └── ai.ts               # AI response types (FreshnessResult, etc.)
│   ├── __tests__/
│   │   └── pages/              # Vitest + RTL tests for all pages
│   ├── App.tsx                 # Router setup + ProtectedRoute component
│   ├── main.tsx                # React entry point (wraps with AppProvider)
│   ├── index.css               # Global styles: Tailwind + custom theme tokens
│   └── App.css                 # App-level styles
├── index.html                  # HTML entry point
├── vite.config.ts              # Vite + Tailwind plugin config
├── vercel.json                 # Vercel deploy config (SPA rewrite + API routes)
├── eslint.config.js            # ESLint flat config (React hooks + refresh)
└── package.json
```

---

## Development Workflow

### Setup

```bash
npm install
```

Create a `.env` file with:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key   # Used only by Vercel serverless functions
```

> `GEMINI_API_KEY` is never exposed to the browser. It is only read server-side in `/api/gemini.js` and `/api/gemini-image.js`.

### Dev Server

```bash
npm run dev        # Starts at http://localhost:5173
```

### Build & Preview

```bash
npm run build      # Outputs to /dist
npm run preview    # Preview production build locally
```

### Tests

```bash
npm test -- --run  # Run all tests once
npm test           # Watch mode
```

### Linting

```bash
npm run lint       # Run ESLint
```

---

## Architecture

### State Management

Global state lives in `AppContext` (`/src/context/AppContext.tsx`) and is accessed via the `useApp()` hook:

```tsx
const { user, beans, brews, stats, addBean, saveBrew, getActiveBean } = useApp()
```

**Context provides:**
- Auth state: `user`, `loading`, `initialized`, `supabase`, `isSupabaseConfigured`
- Data: `beans[]`, `brews[]`, `stats` (memoized via `useMemo` — only recalculates when beans/brews change)
- CRUD: `addBean()`, `updateBean()`, `deleteBean()`, `saveBrew()`, `refresh()`, `resetAllData()`
- Bean selection: `getActiveBean()`, `setActiveBeanId()` — backed by React state so switching beans re-renders instantly without a page reload or network call
- Draft brew (localStorage): `getPendingBrew()`, `setPendingBrew()`, `clearPendingBrew()`
- Utilities: `formatDate()`, `formatRatio()`, `formatTime()`, `buildChartPath()`, `getTip()`, `getPhases()`

### Data Layer (`/src/lib/appData.ts`)

All Supabase interactions go through `appData.ts`. It handles:
- Data fetching with a 12-second timeout wrapper
- Schema transformation: `camelCase` (client) ↔ `snake_case` (DB)
- LocalStorage snapshot cache (`artisanal_beans_[userId]`, `artisanal_brews_[userId]`) — written once after a successful `loadData`, used as a read-only fallback if Supabase is unavailable on the next load. Not written after individual mutations.
- Graceful degradation to cached data when Supabase is unavailable
- Mappers: `beanFromDb()`, `beanToDb()`, `brewFromDb()`, `brewToDb()`
- Bean validation in `validateBean()` — shared by both `addBean` and `updateBean`

### Routing

React Router v7 with a `ProtectedRoute` wrapper in `App.tsx`:

| Route | Component | Auth Required |
|---|---|---|
| `/login` | `Login.tsx` | No |
| `/` | `Dashboard.tsx` | Yes |
| `/beans` | `Beans.tsx` | Yes |
| `/brew-setup` | `BrewSetup.tsx` | Yes |
| `/guided-brew` | `GuidedBrew.tsx` | Yes |
| `/taste-analysis` | `TasteAnalysis.tsx` | Yes |
| `/analytics` | `Analytics.tsx` | Yes |
| `/recipes` | `Recipes.tsx` | Yes |
| `/settings` | `Settings.tsx` | Yes |
| `*` | — | Redirect to `/` |

Vercel rewrites all non-API paths to `/index.html` for SPA behavior.

### AI Integration

**Gemini AI** is accessed exclusively through two Vercel serverless functions:

- `POST /api/gemini` — Text prompts (brew suggestions, grind adjustments)
- `POST /api/gemini-image` — Vision analysis (bean bag image OCR, multilingual)

These functions read `process.env.GEMINI_API_KEY` server-side. Client code calls these routes via `fetch('/api/gemini', ...)`. Do not expose the Gemini API key to the frontend.

Client-side wrappers are in:
- `src/lib/analyzeBean.ts` — Sends base64 bean images for OCR extraction
- `src/lib/aiBrewAssist.ts` — Builds prompts for brew optimization tips

#### AI Fallback Behaviour

All Gemini calls in `aiBrewAssist.ts` use an **8-second `AbortController` timeout**. If the model is rate-limited, slow, or unreachable, the request is cancelled and a **rule-based fallback** is returned instead of an error. Fallback results carry `isFallback: true` so the UI can surface a subtle offline indicator.

Fallback functions:
- `getFallbackBrewAnalysis()` — derives `headline`, `tip`, and `extractionNote` from taste tags and extraction %. Detects under-extraction (sour/bright/thin tags or `extraction < 18`) and over-extraction (bitter/astringent tags or `extraction > 24`).
- `getFallbackGrindSuggestion()` — uses the same tag/extraction logic to produce a `direction`/`amount`/`reasoning`/`tip` object matching the grind card shape.

When adding a new AI feature, follow the same pattern: wrap the `callGemini` call in `try/catch` and return a meaningful hardcoded fallback.

### Authentication

- **Google OAuth** via Supabase Auth
- **Demo mode**: Anonymous sign-in (no account required)
- Auth state is managed in `AppContext`; unauthenticated users are redirected to `/login`

### Extraction Yield

The app estimates extraction yield using: `(water / dose) * 1.2`

This produces values in the realistic 18–22% range for specialty coffee ratios without a refractometer. SCA target range is 18–22%. Values outside this range trigger guidance in the Dashboard Extraction Window and TasteAnalysis grind suggestion cards.

Old brews saved with the broken formula `(dose / water) * 100 * 1.2` (values < 15%) can be repaired via **Settings → Fix Extraction Values**, which calls `migrateExtractionValues()`.

---

## Styling Conventions

### Tailwind CSS v4

This project uses Tailwind v4's `@theme` directive in `index.css` to define Material Design 3 tokens:

```css
@theme {
  --color-primary: #271310;
  --color-primary-container: #3e2723;
  --color-background: #fbf9f5;
  --color-surface: #fbf9f5;
  /* ... */
}
```

Always use theme tokens (e.g., `bg-primary`, `text-on-primary`) instead of raw hex colors.

### Custom CSS Classes

Defined in `index.css`:

| Class | Purpose |
|---|---|
| `.brew-gradient` | Primary color gradient for headers/banners |
| `.glass-panel` | Frosted glass card effect |
| `.timer-display` | Large serif timer font styling |
| `.param-input` | Custom styled number input |
| `.param-track` / `.param-fill` | Custom range slider track |
| `.tag-active` / `.tag-inactive` | Taste tag toggle states |
| `.animate-spin` | Spinner animation |

### Typography

- **Headings**: `font-serif` → Noto Serif
- **Body/UI**: `font-sans` → Manrope
- **Icons**: Material Symbols Outlined (via `<span className="material-symbols-outlined">icon_name</span>`)

---

## Key Conventions

### File Naming
- All source files use `.tsx` (components/pages) or `.ts` (utilities/types)
- Pages and components use `PascalCase.tsx`
- Utility/library files use `camelCase.ts`

### Component Patterns
- Page components live in `src/pages/`, shared layout shell in `src/components/`
- Sub-components live in `src/components/<domain>/` (e.g., `beans/BeanCard.tsx`)
- Local component state for UI (modals, form fields, toggles); global context for persistent data
- Controlled inputs with `useState`; async operations with `try/catch`

### Bean Empty State
Beans with `remainingGrams <= 0` are blocked from brewing at every entry point:
- **Dashboard**: CTA changes to "Manage Beans"; active badge shows "Empty" in error red
- **BeanCard**: Badge shows "Active · Empty" when active and out of stock
- **BeanDetailModal**: "Brew This Bean" replaced with "Out of Stock — Refill to Brew"
- **BrewSetup**: "Enter Guided Mode" replaced with a stock warning

### Adding a New Page
1. Create `src/pages/NewPage.tsx`
2. Add a `<Route>` in `App.tsx` inside the `ProtectedRoute` wrapper (or without for public)
3. Add a navigation entry in `src/components/Layout.tsx` (sidebar links)
4. Add any data operations to `AppContext.tsx` and `appData.ts`
5. Add a test file in `src/__tests__/pages/NewPage.test.tsx`

### Adding a New AI Feature
1. Add client-side prompt building logic to `src/lib/aiBrewAssist.ts` (or a new lib file)
2. Call `POST /api/gemini` (text) or `POST /api/gemini-image` (vision) via `fetch`
3. Do NOT add new backend routes; use the existing Vercel functions
4. Wrap the `callGemini` call in `try/catch` and return a rule-based fallback — `callGemini` already applies the 8-second timeout via `AbortController`

### Adding a New Data Field
1. Update the DB schema in Supabase (add column to `beans` or `brews` table)
2. Update `beanToDb()`/`beanFromDb()` (or brew equivalents) in `appData.ts`
3. Update the relevant type in `src/types/`
4. Update the relevant page component form and display
5. Update the context if the new field needs to be part of computed stats

### Environment Variables
- Prefix browser-accessible variables with `VITE_` (e.g., `VITE_SUPABASE_URL`)
- Server-only secrets (like `GEMINI_API_KEY`) must NOT have the `VITE_` prefix

---

## Testing

Tests live in `src/__tests__/pages/` and use **Vitest** + **React Testing Library**.

Each test file:
- Mocks `useApp()` via `vi.spyOn(AppContextModule, 'useApp')`
- Uses a `makeContext()` helper returning a full `AppContextValue` with sensible defaults
- Wraps renders in `<MemoryRouter>` for pages that use routing

When adding a new field to `AppContextValue`, update the `makeContext()` helper in every test file.

---

## Performance Notes

- **Bean switching** is instant — `activeBeanId` is React state in `AppContext`; `setActiveBeanId()` triggers a re-render with no page reload or network call.
- **Stats** are memoized — `getStats()` only recalculates when `beans` or `brews` change.
- **LocalStorage cache** is written once after a successful `loadData()`, not after every mutation. It is a fallback, not a primary store.
- **Pending brew** (`artisanal_pending_brew`) must stay in localStorage — it survives navigation between BrewSetup → GuidedBrew → TasteAnalysis within a session.

---

## Deployment

The app deploys automatically to Vercel from the `main` branch.

- **Frontend**: Built by Vite, served as static assets from `/dist`
- **API**: `/api/*.js` files become Vercel serverless functions
- **Routing**: All paths rewritten to `/index.html` except `/api/*`

Supabase handles its own hosting; only the URL and anon key are needed client-side.

---

## Known Limitations

- **No TypeScript strict mode** — `strict: true` is not enabled; some casts are loose
- **No pagination** — all brews are fetched in a single query; may be slow for users with 1000+ brews
- **Demo mode data is not persisted** — anonymous users lose data on sign-out
