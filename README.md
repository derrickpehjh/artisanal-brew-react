# The Artisanal Brew

A specialty coffee brewing tracker. Log brews, manage your bean cellar, follow guided brew sessions, and analyse your extractions — all backed by a persistent cloud database.

## Features

- **Bean Cellar** — track your coffee beans with stock levels, roast details, and tasting notes. Upload photos of the bag and let AI auto-fill the details in any language.
- **Guided Brew** — step-by-step brew timer with phase arc for V60, Chemex, AeroPress, and French Press.
- **Taste Analysis** — rate your cup, tag flavour notes, and get AI sommelier suggestions with extraction analysis. Falls back to rule-based insights when the AI is unavailable.
- **Analytics** — SVG chart of rating vs extraction over time, best brews gallery, brew history feed.
- **Recipes** — replicate your best brews or try community classics with one click.
- **Settings** — export your data as JSON or reset your cellar.

## Tech Stack

- **React 19** + **Vite 8**
- **Tailwind CSS v4** with Material Design 3 colour tokens
- **Supabase** — auth (Google OAuth + anonymous demo) and Postgres database
- **Google Gemini 2.5 Flash** — vision AI for bean bag scanning (free tier)
- **React Router v7**

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd artisanal-brew-react
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Supabase — https://supabase.com/dashboard → Settings → API
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_supabase_publishable_key

# Google Gemini (free) — https://aistudio.google.com/app/apikey
# No VITE_ prefix — this key is only read server-side by Vercel functions
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Set up Supabase

Run the following SQL in your Supabase project's SQL editor:

```sql
create table beans (
  id text primary key,
  user_id uuid references auth.users not null,
  name text, origin text, process text,
  roast_level text, roast_date text,
  total_grams int, remaining_grams int, notes text,
  community_rating numeric, community_reviews int,
  created_at timestamptz default now()
);
alter table beans enable row level security;
create policy "own beans" on beans for all using (auth.uid() = user_id);

create table brews (
  id text primary key,
  user_id uuid references auth.users not null,
  bean_id text, bean_name text, method text,
  dose numeric, water numeric, temp numeric,
  ratio text, grind_size text, brew_time text,
  rating int, taste_tags text[], notes text,
  date timestamptz, extraction numeric,
  created_at timestamptz default now()
);
alter table brews enable row level security;
create policy "own brews" on brews for all using (auth.uid() = user_id);
```

For Google OAuth, enable it in **Supabase → Authentication → Providers → Google**.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). New accounts are automatically seeded with demo beans and brews.

## AI Bean Scanning

In the **Add Bean** form, upload one or more photos of a coffee bag (any language). Gemini analyses all images together and auto-fills name, origin, process, roast level, roast date, weight, and tasting notes. Fields filled by AI are highlighted in the form so you can review and adjust before saving.

Requires a free Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey).
