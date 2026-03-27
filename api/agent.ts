import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { PERSONA, BEAN_CATALOG } from '../agent/src/persona.js'
import { generateBrewParams, formatRatio } from '../agent/src/brew-engine.js'
import { generateTasteProfile, generateFallbackNotes } from '../agent/src/taste-engine.js'
import { checkLowBeans, selectBeanForBrew, generateNewBean } from '../agent/src/bean-manager.js'
import { validateAll } from '../agent/src/validator.js'
import { generateBrewNotes, generatePurchaseNote } from '../agent/src/gemini.js'
import type { AgentBean, AgentBrew, BrewMethod } from '../agent/src/types.js'

export const maxDuration = 60

// ---------------------------------------------------------------------------
// Supabase helpers (inline — no dotenv needed in Vercel)
// ---------------------------------------------------------------------------

function getClient() {
  const url = process.env.VITE_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function ensureAuth(supabase: ReturnType<typeof getClient>) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return
  const { error } = await supabase.auth.signInWithPassword({
    email:    process.env.SUPABASE_AGENT_EMAIL!,
    password: process.env.SUPABASE_AGENT_PASSWORD!,
  })
  if (error) throw new Error(`Auth failed: ${error.message}`)
}

async function fetchBeans(supabase: ReturnType<typeof getClient>, userId: string): Promise<AgentBean[]> {
  const { data, error } = await supabase.from('beans').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error(`fetchBeans: ${error.message}`)
  return (data ?? []).map(r => ({
    id: r.id, name: r.name, origin: r.origin, process: r.process,
    roastLevel: r.roast_level, roastDate: r.roast_date,
    totalGrams: r.total_grams, remainingGrams: r.remaining_grams, notes: r.notes,
  }))
}

async function fetchBrews(supabase: ReturnType<typeof getClient>, userId: string): Promise<AgentBrew[]> {
  const { data, error } = await supabase.from('brews').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(100)
  if (error) throw new Error(`fetchBrews: ${error.message}`)
  return (data ?? []).map(r => ({
    id: r.id, beanId: r.bean_id, beanName: r.bean_name, method: r.method,
    dose: r.dose, water: r.water, temp: r.temp, ratio: r.ratio,
    grindSize: r.grind_size, brewTime: r.brew_time, rating: r.rating,
    tasteTags: r.taste_tags ?? [], notes: r.notes, date: r.date, extraction: r.extraction,
  }))
}

async function insertBean(supabase: ReturnType<typeof getClient>, userId: string, bean: Omit<AgentBean, 'id'>): Promise<AgentBean> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('beans').insert({ id, user_id: userId, name: bean.name, origin: bean.origin, process: bean.process, roast_level: bean.roastLevel, roast_date: bean.roastDate, total_grams: bean.totalGrams, remaining_grams: bean.remainingGrams, notes: bean.notes })
  if (error) throw new Error(`insertBean: ${error.message}`)
  return { id, ...bean }
}

async function insertBrew(supabase: ReturnType<typeof getClient>, userId: string, brew: Omit<AgentBrew, 'id'>): Promise<void> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('brews').insert({ id, user_id: userId, bean_id: brew.beanId ?? null, bean_name: brew.beanName, method: brew.method, dose: brew.dose, water: brew.water, temp: brew.temp, ratio: brew.ratio, grind_size: brew.grindSize, brew_time: brew.brewTime, rating: brew.rating, taste_tags: brew.tasteTags, notes: brew.notes, date: brew.date, extraction: brew.extraction })
  if (error) throw new Error(`insertBrew: ${error.message}`)
}

async function updateBeanGrams(supabase: ReturnType<typeof getClient>, id: string, remainingGrams: number): Promise<void> {
  const { error } = await supabase.from('beans').update({ remaining_grams: remainingGrams }).eq('id', id)
  if (error) throw new Error(`updateBeanGrams: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function singaporeNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: PERSONA.timezone }))
}

function todayString(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

function methodForDay(d: Date): BrewMethod {
  const day = d.getDay()
  if (day === 6) return PERSONA.preferredMethods.saturday
  if (day === 0) return PERSONA.preferredMethods.sunday
  return PERSONA.preferredMethods.weekday
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify Vercel cron secret (automatically set by Vercel)
  const auth = req.headers.authorization
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const log: string[] = []
  const userId = PERSONA.userId

  try {
    const supabase = getClient()
    await ensureAuth(supabase)
    log.push('Authenticated.')

    // ── Load state ──────────────────────────────────────────────────────────
    let beans = await fetchBeans(supabase, userId)
    const brews = await fetchBrews(supabase, userId)
    log.push(`Loaded ${beans.length} bean(s), ${brews.length} brew(s).`)

    // ── Seed if new user ─────────────────────────────────────────────────────
    if (beans.length === 0) {
      for (const template of BEAN_CATALOG.slice(0, 2)) {
        const roastDate = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]!
        const inserted = await insertBean(supabase, userId, { ...template, roastDate, totalGrams: 200, remainingGrams: 200 })
        beans.push(inserted)
        log.push(`Seeded: ${inserted.name}`)
      }
    }

    // ── Inventory check ──────────────────────────────────────────────────────
    const lowBeans = checkLowBeans(beans)
    for (const { bean, isCritical } of lowBeans) {
      log.push(`[${isCritical ? 'CRITICAL' : 'LOW'}] ${bean.name}: ${bean.remainingGrams}g`)
      if (isCritical || Math.random() > 0.2) {
        const newBeanData = generateNewBean(beans)
        const purchaseNote = await generatePurchaseNote({
          beanName: newBeanData.name, origin: newBeanData.origin, process: newBeanData.process,
          roaster: newBeanData.notes.match(/from (.+)\)/)?.[1] ?? 'local roaster',
          triggerBean: bean.name, triggerRemaining: bean.remainingGrams,
        })
        const inserted = await insertBean(supabase, userId, newBeanData)
        beans.push(inserted)
        log.push(`Purchased: ${inserted.name}${purchaseNote ? ` — "${purchaseNote}"` : ''}`)
      }
    }

    // ── Daily brew ───────────────────────────────────────────────────────────
    const sgNow = singaporeNow()
    const today = todayString(sgNow)
    const alreadyBrewed = brews.some(b => b.date.startsWith(today))

    if (alreadyBrewed) {
      log.push(`Already brewed today (${today}). Skipping.`)
    } else {
      const bean = selectBeanForBrew(beans)
      if (!bean) {
        log.push('No stock available — cannot brew.')
      } else {
        const method = methodForDay(sgNow)
        const params = generateBrewParams(bean, method)
        const { rating, tags } = generateTasteProfile(params.extraction, bean.origin, bean.roastLevel)
        const aiNotes = await generateBrewNotes({ beanName: bean.name, origin: bean.origin, method, ...params, rating, tags })
        const notes = aiNotes ?? generateFallbackNotes(bean.name, method, rating, tags, params.extraction)

        const [hourMin, hourMax] = PERSONA.brewHourRange
        const brewHour = hourMin + Math.floor(Math.random() * (hourMax - hourMin + 1))
        const brewDate = new Date(sgNow)
        brewDate.setHours(brewHour, Math.floor(Math.random() * 60), 0, 0)

        await insertBrew(supabase, userId, {
          beanId: bean.id, beanName: bean.name, method,
          dose: params.dose, water: params.water, temp: params.temp,
          ratio: formatRatio(params.dose, params.water),
          grindSize: params.grindSize, brewTime: params.brewTime,
          rating, tasteTags: tags, notes,
          date: brewDate.toISOString(), extraction: params.extraction,
        })

        const newRemaining = Math.max(0, bean.remainingGrams - params.dose)
        await updateBeanGrams(supabase, bean.id, newRemaining)

        log.push(`Brewed: ${bean.name} via ${method} — ${rating}/5 (${tags.join(', ')})`)
        log.push(`Notes: "${notes}"`)
        log.push(`Stock: ${bean.name} ${bean.remainingGrams}g → ${newRemaining.toFixed(1)}g`)
      }
    }

    // ── Validation ───────────────────────────────────────────────────────────
    const finalBeans = await fetchBeans(supabase, userId)
    const finalBrews = await fetchBrews(supabase, userId)
    const issues = validateAll(finalBeans, finalBrews)
    const errors = issues.filter(i => i.severity === 'error')
    const warnings = issues.filter(i => i.severity === 'warning')

    for (const e of errors)   log.push(`[ERROR] ${e.entityName} — ${e.field}: ${e.message}`)
    for (const w of warnings) log.push(`[WARN]  ${w.entityName} — ${w.field}: ${w.message}`)

    log.push(`Validation: ${errors.length} error(s), ${warnings.length} warning(s).`)

    return res.status(errors.length > 0 ? 500 : 200).json({ ok: errors.length === 0, log })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.push(`Fatal: ${message}`)
    return res.status(500).json({ ok: false, log })
  }
}
