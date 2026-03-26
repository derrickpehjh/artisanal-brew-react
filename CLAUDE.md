# CLAUDE.md — Artisanal Brew React

This file documents the codebase structure, conventions, and workflows for AI assistants working on this project.

---

## Project Overview

**Artisanal Brew** is a specialty coffee brewing tracker built with React. Users can:
- Manage a bean cellar (add/edit beans with AI-powered image scanning)
- Log and time brew sessions with guided step-by-step workflows
- Rate brews with taste tags and receive AI-powered optimization suggestions
- View analytics and charts across their brew history
- Save and browse brew recipes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 (JSX, no TypeScript) |
| Build Tool | Vite 8 |
| CSS | Tailwind CSS v4 + custom theme tokens |
| Router | React Router v7 (BrowserRouter) |
| Backend | Supabase (PostgreSQL + Auth) |
| AI | Google Gemini 2.5 Flash (text + vision) |
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
│   │   └── Layout.jsx          # Shared app shell: sidebar + top bar
│   ├── context/
│   │   └── AppContext.jsx      # Global React Context (auth, data, utilities)
│   ├── lib/
│   │   ├── supabase.js         # Supabase client initialization
│   │   ├── appData.js          # Core data layer: CRUD ops, mappers, caching
│   │   ├── analyzeBean.js      # AI bean image analysis logic
│   │   └── aiBrewAssist.js     # AI brew suggestions and grind assistance
│   ├── pages/
│   │   ├── Login.jsx           # Auth (Google OAuth + demo mode)
│   │   ├── Dashboard.jsx       # Home: active bean, recent brews, stats
│   │   ├── Beans.jsx           # Bean cellar: add/edit/delete + AI scan
│   │   ├── BrewSetup.jsx       # New brew form (dose, water, grind, method)
│   │   ├── GuidedBrew.jsx      # Step-by-step brew timer with phases
│   │   ├── TasteAnalysis.jsx   # Post-brew rating, taste tags, AI sommelier + extraction analysis (offline fallback)
│   │   ├── Analytics.jsx       # Stats, SVG charts, brew history
│   │   ├── Recipes.jsx         # Browse/generate brew recipes
│   │   └── Settings.jsx        # Export data, reset, preferences
│   ├── App.jsx                 # Router setup + ProtectedRoute component
│   ├── main.jsx                # React entry point (wraps with AppProvider)
│   ├── index.css               # Global styles: Tailwind + custom theme tokens
│   └── App.css                 # App-level styles
├── index.html                  # HTML entry point
├── vite.config.js              # Vite + Tailwind plugin config
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

### Linting

```bash
npm run lint       # Run ESLint
```

No tests are configured. The project uses manual/integration testing via the dev server.

---

## Architecture

### State Management

Global state lives in `AppContext` (`/src/context/AppContext.jsx`) and is accessed via the `useApp()` hook:

```jsx
const { user, beans, brews, stats, addBean, saveBrew, getActiveBean } = useApp()
```

**Context provides:**
- Auth state: `user`, `loading`, `initialized`, `supabase`, `isSupabaseConfigured`
- Data: `beans[]`, `brews[]`, `stats` (computed)
- CRUD: `addBean()`, `updateBean()`, `deleteBean()`, `saveBrew()`, `refresh()`, `resetAllData()`
- Bean selection: `getActiveBean()`, `setActiveBeanId()`
- Draft brew (localStorage): `getPendingBrew()`, `setPendingBrew()`, `clearPendingBrew()`
- Utilities: `formatDate()`, `formatRatio()`, `formatTime()`, `buildChartPath()`, `getTip()`, `getPhases()`

### Data Layer (`/src/lib/appData.js`)

All Supabase interactions go through `appData.js`. It handles:
- Data fetching with a 12-second timeout wrapper
- Schema transformation: `camelCase` (client) ↔ `snake_case` (DB)
- LocalStorage caching (keys: `artisanal_beans_[userId]`, `artisanal_brews_[userId]`)
- Graceful degradation to cached data when Supabase is unavailable
- Mappers: `beanFromDb()`, `beanToDb()`, `brewFromDb()`, `brewToDb()`

### Routing

React Router v7 with a `ProtectedRoute` wrapper in `App.jsx`:

| Route | Component | Auth Required |
|---|---|---|
| `/login` | `Login.jsx` | No |
| `/` | `Dashboard.jsx` | Yes |
| `/beans` | `Beans.jsx` | Yes |
| `/brew-setup` | `BrewSetup.jsx` | Yes |
| `/guided-brew` | `GuidedBrew.jsx` | Yes |
| `/taste-analysis` | `TasteAnalysis.jsx` | Yes |
| `/analytics` | `Analytics.jsx` | Yes |
| `/recipes` | `Recipes.jsx` | Yes |
| `/settings` | `Settings.jsx` | Yes |
| `*` | — | Redirect to `/` |

Vercel rewrites all non-API paths to `/index.html` for SPA behavior.

### AI Integration

**Gemini AI** is accessed exclusively through two Vercel serverless functions:

- `POST /api/gemini` — Text prompts (brew suggestions, grind adjustments)
- `POST /api/gemini-image` — Vision analysis (bean bag image OCR, multilingual)

These functions read `process.env.GEMINI_API_KEY` server-side. Client code calls these routes via `fetch('/api/gemini', ...)`. Do not expose the Gemini API key to the frontend.

Client-side wrappers are in:
- `src/lib/analyzeBean.js` — Sends base64 bean images for OCR extraction
- `src/lib/aiBrewAssist.js` — Builds prompts for brew optimization tips

#### AI Fallback Behaviour

All Gemini calls in `aiBrewAssist.js` use an **8-second `AbortController` timeout**. If the model is rate-limited, slow, or unreachable, the request is cancelled and a **rule-based fallback** is returned instead of an error. Fallback results carry `isFallback: true` so the UI can surface a subtle offline indicator.

Fallback functions:
- `getFallbackBrewAnalysis()` — derives `headline`, `tip`, and `extractionNote` from taste tags and extraction %. Detects under-extraction (sour/bright/thin tags or `extraction < 18`) and over-extraction (bitter/astringent tags or `extraction > 24`).
- `getFallbackGrindSuggestion()` — uses the same tag/extraction logic to produce a `direction`/`amount`/`reasoning`/`tip` object matching the grind card shape.

When adding a new AI feature, follow the same pattern: wrap the `callGemini` call in `try/catch` and return a meaningful hardcoded fallback.

### Authentication

- **Google OAuth** via Supabase Auth
- **Demo mode**: Anonymous sign-in (no account required)
- Auth state is managed in `AppContext`; unauthenticated users are redirected to `/login`

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
- All source files use `.jsx` (not `.tsx`). No TypeScript.
- Pages and components use `PascalCase.jsx`
- Utility/library files use `camelCase.js`

### Component Patterns
- Page components live in `src/pages/`, the shared layout shell in `src/components/`
- Local component state for UI (modals, form fields, toggles); global context for persistent data
- Controlled inputs with `useState`; async operations with `try/catch`

### Adding a New Page
1. Create `src/pages/NewPage.jsx`
2. Add a `<Route>` in `App.jsx` inside the `ProtectedRoute` wrapper (or without for public)
3. Add a navigation entry in `src/components/Layout.jsx` (sidebar links)
4. Add any data operations to `AppContext.jsx` and `appData.js`

### Adding a New AI Feature
1. Add client-side prompt building logic to `src/lib/aiBrewAssist.js` (or a new lib file)
2. Call `POST /api/gemini` (text) or `POST /api/gemini-image` (vision) via `fetch`
3. Do NOT add new backend routes; use the existing Vercel functions
4. Wrap the `callGemini` call in `try/catch` and return a rule-based fallback — `callGemini` already applies the 8-second timeout via `AbortController`

### Adding a New Data Field
1. Update the DB schema in Supabase (add column to `beans` or `brews` table)
2. Update `beanToDb()`/`beanFromDb()` (or brew equivalents) in `appData.js`
3. Update the relevant page component form and display
4. Update the context if the new field needs to be part of computed stats

### Environment Variables
- Prefix browser-accessible variables with `VITE_` (e.g., `VITE_SUPABASE_URL`)
- Server-only secrets (like `GEMINI_API_KEY`) must NOT have the `VITE_` prefix

---

## Deployment

The app deploys automatically to Vercel from the `main` branch.

- **Frontend**: Built by Vite, served as static assets from `/dist`
- **API**: `/api/*.js` files become Vercel serverless functions
- **Routing**: All paths rewritten to `/index.html` except `/api/*`

Supabase handles its own hosting; only the URL and anon key are needed client-side.

---

## Known Limitations

- **No automated tests** — Vitest + React Testing Library would be a good addition
- **No TypeScript** — All files are plain JSX/JS; type safety relies on runtime checks
- **Large page components** — `Beans.jsx` (691 lines) could benefit from splitting into sub-components
- **Demo mode data is not persisted** — Anonymous users lose data on sign-out
