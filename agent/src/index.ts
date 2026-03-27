/**
 * Artisanal Brew — Daily User Agent
 *
 * Simulates Wei Liang, a specialty coffee brewer in Singapore, who:
 *   - Brews coffee every morning using the Artisanal Brew app
 *   - Monitors bean inventory and purchases new bags when running low
 *   - Validates all app data for integrity issues after each run
 *
 * Usage:
 *   npm start              — live run (writes to Supabase)
 *   npm run dry-run        — preview actions without writing anything
 */

import 'dotenv/config'
import { PERSONA, BEAN_CATALOG } from './persona.js'
import { fetchBeans, fetchBrews, insertBean, insertBrew, updateBeanGrams, ensureAuth } from './supabase.js'
import { generateBrewParams, formatRatio } from './brew-engine.js'
import { generateTasteProfile, generateFallbackNotes } from './taste-engine.js'
import { checkLowBeans, selectBeanForBrew, generateNewBean } from './bean-manager.js'
import { validateAll } from './validator.js'
import { generateBrewNotes, generatePurchaseNote } from './gemini.js'
import type { AgentBean, AgentBrew, AgentReport, BrewMethod } from './types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isDryRun = process.argv.includes('--dry-run')

function now(): string {
  return new Date().toISOString()
}

/** Current wall-clock time in Singapore (Asia/Singapore, UTC+8) */
function singaporeNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: PERSONA.timezone }))
}

function todayString(d: Date): string {
  // Returns YYYY-MM-DD in local (Singapore) context
  return d.toLocaleDateString('en-CA')  // en-CA gives ISO date format
}

function methodForDay(d: Date): BrewMethod {
  const day = d.getDay() // 0 = Sun, 6 = Sat
  if (day === 6) return PERSONA.preferredMethods.saturday
  if (day === 0) return PERSONA.preferredMethods.sunday
  return PERSONA.preferredMethods.weekday
}

function hasBrewedToday(brews: AgentBrew[], todayStr: string): boolean {
  return brews.some(b => b.date.startsWith(todayStr))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const userId = PERSONA.userId

  const report: AgentReport = {
    date: now(),
    userId,
    isDryRun,
    beansChecked: 0,
    beansLow: [],
    beansPurchased: [],
    brewedToday: null,
    validationIssues: [],
    actionsLog: [],
    summary: '',
  }

  const log = (msg: string): void => {
    const line = `[${now()}] ${msg}`
    console.log(line)
    report.actionsLog.push(msg)
  }

  const sep = () => log('─'.repeat(60))

  log(`Artisanal Brew Agent — ${PERSONA.name}, ${PERSONA.location}`)
  log(isDryRun ? 'Mode: DRY RUN (no data will be written)' : 'Mode: LIVE')
  sep()

  // ── 0. Authenticate ───────────────────────────────────────────────────────
  await ensureAuth()
  log('Authenticated with Supabase.')

  // ── 1. Load current state ─────────────────────────────────────────────────
  log('Loading data from Supabase…')
  let beans = await fetchBeans(userId)
  const brews = await fetchBrews(userId)
  report.beansChecked = beans.length
  log(`Found ${beans.length} bean(s) and ${brews.length} brew(s) on record`)

  // ── 2. Seed initial inventory if brand new user ───────────────────────────
  if (beans.length === 0) {
    sep()
    log('No beans found — seeding initial inventory (2 bags)…')
    const seeds = BEAN_CATALOG.slice(0, 2)
    for (const template of seeds) {
      const roastDate = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]!
      const seedBean: Omit<AgentBean, 'id'> = {
        ...template,
        roastDate,
        totalGrams: 200,
        remainingGrams: 200,
      }
      if (!isDryRun) {
        const inserted = await insertBean(userId, seedBean)
        beans.push(inserted)
        log(`  + Seeded: ${inserted.name} (${inserted.remainingGrams}g)`)
      } else {
        log(`  [dry] Would seed: ${seedBean.name} (${seedBean.remainingGrams}g)`)
      }
    }
    if (!isDryRun) beans = await fetchBeans(userId)
  }

  // ── 3. Inventory check ────────────────────────────────────────────────────
  sep()
  log('Checking bean inventory…')
  const lowBeans = checkLowBeans(beans)

  if (lowBeans.length === 0) {
    log('All beans well-stocked.')
  } else {
    for (const { bean, isCritical } of lowBeans) {
      const level = isCritical ? 'CRITICAL' : 'LOW'
      log(`  [${level}] ${bean.name}: ${bean.remainingGrams}g remaining`)
      report.beansLow.push(`${bean.name} (${bean.remainingGrams}g)`)
    }
  }

  // ── 4. Purchase new beans if needed ──────────────────────────────────────
  for (const { bean: triggerBean, isCritical } of lowBeans) {
    // Always purchase for critical; 80% chance for low
    if (!isCritical && Math.random() > 0.8) continue

    sep()
    log(`Placing order because ${triggerBean.name} is running ${isCritical ? 'critically' : ''} low…`)

    const newBeanData = generateNewBean(beans)

    // Try to get an AI-generated reason for the purchase
    const purchaseNote = await generatePurchaseNote({
      beanName: newBeanData.name,
      origin: newBeanData.origin,
      process: newBeanData.process,
      roaster: newBeanData.notes.match(/from (.+)\)/)?.[1] ?? 'local roaster',
      triggerBean: triggerBean.name,
      triggerRemaining: triggerBean.remainingGrams,
    })
    if (purchaseNote) log(`  Reason: "${purchaseNote}"`)

    if (!isDryRun) {
      const inserted = await insertBean(userId, newBeanData)
      beans.push(inserted)
      report.beansPurchased.push(inserted.name)
      log(`  + Purchased: ${inserted.name} (${inserted.remainingGrams}g, roasted ${inserted.roastDate})`)
    } else {
      log(`  [dry] Would purchase: ${newBeanData.name} (${newBeanData.remainingGrams}g)`)
      report.beansPurchased.push(`${newBeanData.name} [dry-run]`)
    }
  }

  // ── 5. Daily brew ─────────────────────────────────────────────────────────
  sep()
  log('Checking morning brew…')

  const sgNow  = singaporeNow()
  const today  = todayString(sgNow)

  if (hasBrewedToday(brews, today)) {
    log(`Already brewed today (${today}). Skipping.`)
    report.brewedToday = 'skipped (already brewed today)'
  } else {
    const bean = selectBeanForBrew(beans)

    if (!bean) {
      log('No beans with remaining stock — cannot brew today!')
      report.brewedToday = 'skipped (no stock)'
    } else {
      const method = methodForDay(sgNow)
      const params = generateBrewParams(bean, method)
      const { rating, tags } = generateTasteProfile(params.extraction, bean.origin, bean.roastLevel)

      // Brew timestamp: random minute within Wei Liang's brew window
      const [hourMin, hourMax] = PERSONA.brewHourRange
      const brewHour   = hourMin + Math.floor(Math.random() * (hourMax - hourMin + 1))
      const brewMinute = Math.floor(Math.random() * 60)
      const brewDate   = new Date(sgNow)
      brewDate.setHours(brewHour, brewMinute, 0, 0)

      // Generate brew notes — AI-powered with rule-based fallback
      const aiNotes  = await generateBrewNotes({ beanName: bean.name, origin: bean.origin, method, ...params, rating, tags })
      const notes    = aiNotes ?? generateFallbackNotes(bean.name, method, rating, tags, params.extraction)

      const brewPayload: Omit<AgentBrew, 'id'> = {
        beanId:    bean.id,
        beanName:  bean.name,
        method,
        dose:      params.dose,
        water:     params.water,
        temp:      params.temp,
        ratio:     formatRatio(params.dose, params.water),
        grindSize: params.grindSize,
        brewTime:  params.brewTime,
        rating,
        tasteTags: tags,
        notes,
        date:      brewDate.toISOString(),
        extraction: params.extraction,
      }

      log(`  Bean   : ${bean.name} (${bean.remainingGrams}g remaining)`)
      log(`  Method : ${method}`)
      log(`  Params : ${params.dose}g / ${params.water}g water @ ${params.temp}°C`)
      log(`  Grind  : ${params.grindSize}  |  Brew time: ${params.brewTime}`)
      log(`  Extract: ${params.extraction}%`)
      log(`  Rating : ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)`)
      log(`  Tags   : ${tags.join(', ')}`)
      log(`  Notes  : "${notes}"`)
      if (aiNotes) log(`  (notes generated by Gemini AI)`)

      if (!isDryRun) {
        await insertBrew(userId, brewPayload)

        const newRemaining = Math.max(0, bean.remainingGrams - params.dose)
        await updateBeanGrams(bean.id, newRemaining)

        log(`  Saved. Deducted ${params.dose}g → ${bean.name} now has ${newRemaining.toFixed(1)}g`)
        report.brewedToday = `${bean.name} via ${method} — ${rating}/5`
      } else {
        log(`  [dry] Would save brew and deduct ${params.dose}g from ${bean.name}`)
        report.brewedToday = `[dry-run] ${bean.name} via ${method} — ${rating}/5`
      }
    }
  }

  // ── 6. Data validation ────────────────────────────────────────────────────
  sep()
  log('Running data validation…')

  // Re-fetch after writes for an accurate snapshot
  const finalBeans = isDryRun ? beans : await fetchBeans(userId)
  const finalBrews = isDryRun ? brews : await fetchBrews(userId)

  const issues = validateAll(finalBeans, finalBrews)
  report.validationIssues = issues

  const errors   = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')

  if (issues.length === 0) {
    log('All data valid — no issues found.')
  } else {
    for (const i of errors) {
      log(`  [ERROR]  ${i.entityType} "${i.entityName}" — ${i.field}: ${i.message}`)
    }
    for (const w of warnings) {
      log(`  [WARN]   ${w.entityType} "${w.entityName}" — ${w.field}: ${w.message}`)
    }
  }

  // ── 7. Final report ───────────────────────────────────────────────────────
  sep()
  report.summary = [
    `Beans: ${report.beansChecked} checked`,
    report.beansLow.length     ? `low: ${report.beansLow.join(', ')}`       : 'all well-stocked',
    report.beansPurchased.length ? `ordered: ${report.beansPurchased.join(', ')}` : 'no purchases',
    `brew: ${report.brewedToday ?? 'none'}`,
    `validation: ${errors.length} error(s), ${warnings.length} warning(s)`,
  ].join(' | ')

  log(`Summary: ${report.summary}`)
  sep()

  if (errors.length > 0) {
    log('ACTION REQUIRED: data integrity errors detected above.')
    process.exit(1)
  }

  log('Agent run complete.')
}

main().catch(err => {
  console.error('Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
