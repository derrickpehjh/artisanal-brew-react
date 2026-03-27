/**
 * Artisanal Brew — Agentic Loop (Level 3)
 *
 * Replaces the fixed daily script with a true agentic loop powered by
 * Claude's tool use. Claude (as Wei Liang) decides what to do and in what
 * order — checking inventory, reasoning about patterns across recent brews,
 * choosing which bean and grind adjustment to use, and deciding whether to
 * buy more beans.
 *
 * Usage:
 *   npm run loop              — live run (writes to Supabase)
 *   npm run loop-dry-run      — preview actions without writing anything
 *
 * Requires: ANTHROPIC_API_KEY in .env (in addition to the usual Supabase vars)
 */

import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { PERSONA, BEAN_CATALOG } from './persona.js'
import { fetchBeans, fetchBrews, insertBean, insertBrew, updateBeanGrams, ensureAuth } from './supabase.js'
import { generateBrewParams, formatRatio } from './brew-engine.js'
import { generateTasteProfile, generateFallbackNotes } from './taste-engine.js'
import { generateNewBean } from './bean-manager.js'
import { validateAll } from './validator.js'
import { generateBrewNotes } from './gemini.js'
import type { AgentBean, AgentBrew, BrewMethod } from './types.js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const isDryRun = process.argv.includes('--dry-run')
const userId = PERSONA.userId
const MAX_ITERATIONS = 25

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function singaporeNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: PERSONA.timezone }))
}

function todayString(d: Date): string {
  return d.toLocaleDateString('en-CA') // ISO format: YYYY-MM-DD
}

function dayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: PERSONA.timezone })
}

function daysPostRoast(roastDate: string | null): number | null {
  if (!roastDate) return null
  return Math.floor((Date.now() - new Date(roastDate).getTime()) / 86_400_000)
}

function freshnessLabel(days: number | null): string {
  if (days === null) return 'unknown'
  if (days < 7) return 'too fresh (degassing)'
  if (days <= 28) return 'peak'
  if (days <= 45) return 'acceptable'
  return 'going stale'
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const actionsLog: string[] = []

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  actionsLog.push(msg)
}

function sep(): void { log('─'.repeat(60)) }

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolGetBeans(): Promise<object> {
  const beans = await fetchBeans(userId)
  return beans.map(b => {
    const days = daysPostRoast(b.roastDate)
    return {
      id: b.id,
      name: b.name,
      origin: b.origin,
      process: b.process,
      roastLevel: b.roastLevel,
      roastDate: b.roastDate,
      daysPostRoast: days,
      freshness: freshnessLabel(days),
      totalGrams: b.totalGrams,
      remainingGrams: b.remainingGrams,
      notes: b.notes,
      isLow: b.remainingGrams <= PERSONA.lowThreshold,
      isCritical: b.remainingGrams <= PERSONA.criticalThreshold,
    }
  })
}

async function toolGetRecentBrews(limit = 7): Promise<object> {
  const brews = await fetchBrews(userId, limit)
  return brews.map(b => ({
    id: b.id,
    beanName: b.beanName,
    method: b.method,
    date: b.date,
    rating: b.rating,
    tasteTags: b.tasteTags,
    extraction: b.extraction,
    grindSize: b.grindSize,
    notes: b.notes,
  }))
}

async function toolHasBrewedToday(): Promise<{ brewedToday: boolean; date: string }> {
  const sgNow = singaporeNow()
  const today = todayString(sgNow)
  const brews = await fetchBrews(userId, 5)
  return { brewedToday: brews.some(b => b.date.startsWith(today)), date: today }
}

function toolGetCatalog(): object {
  return BEAN_CATALOG.map(b => ({
    name: b.name,
    origin: b.origin,
    process: b.process,
    roastLevel: b.roastLevel,
    notes: b.notes,
    roaster: b.roaster,
  }))
}

async function toolPurchaseBean(beanName?: string): Promise<object> {
  const existingBeans = await fetchBeans(userId)

  let newBeanData: Omit<AgentBean, 'id'>

  if (beanName && beanName !== 'auto') {
    const template = BEAN_CATALOG.find(b => b.name === beanName)
    if (template) {
      const roastDaysAgo = 3 + Math.floor(Math.random() * 5)
      const roastDate = new Date(Date.now() - roastDaysAgo * 86_400_000)
        .toISOString().split('T')[0]!
      newBeanData = {
        name: template.name,
        origin: template.origin,
        process: template.process,
        roastLevel: template.roastLevel,
        roastDate,
        totalGrams: 200,
        remainingGrams: 200,
        notes: `${template.notes} (from ${template.roaster})`,
      }
    } else {
      // Requested bean not in catalog — auto-pick
      newBeanData = generateNewBean(existingBeans)
    }
  } else {
    newBeanData = generateNewBean(existingBeans)
  }

  if (!isDryRun) {
    const inserted = await insertBean(userId, newBeanData)
    log(`Purchased: ${inserted.name} (${inserted.remainingGrams}g, roasted ${inserted.roastDate})`)
    return { success: true, bean: inserted, dryRun: false }
  } else {
    log(`[dry] Would purchase: ${newBeanData.name} (${newBeanData.remainingGrams}g)`)
    return { success: true, bean: { id: 'dry-run-id', ...newBeanData }, dryRun: true }
  }
}

async function toolSaveBrew(params: {
  beanId: string
  method: BrewMethod
  grindAdjustment?: 'finer' | 'coarser' | 'same'
  reasoning?: string
}): Promise<object> {
  const beans = await fetchBeans(userId)
  const bean = beans.find(b => b.id === params.beanId)

  if (!bean) return { success: false, error: `Bean not found: ${params.beanId}` }
  if (bean.remainingGrams <= 0) return { success: false, error: `${bean.name} has no remaining grams` }

  // Generate base brew parameters
  const brewParams = generateBrewParams(bean, params.method)

  // Apply grind adjustment from Claude's reasoning
  if (params.grindAdjustment && params.grindAdjustment !== 'same') {
    const match = brewParams.grindSize.match(/(\d+)/)
    if (match) {
      const clicks = parseInt(match[1]!)
      const adjusted = params.grindAdjustment === 'finer'
        ? Math.max(1, clicks - 2)
        : clicks + 2
      brewParams.grindSize = `${adjusted} clicks`
      // Finer → higher extraction, coarser → lower
      const delta = adjusted - clicks
      brewParams.extraction = Math.round((brewParams.extraction - delta * 0.4) * 10) / 10
    }
  }

  const { rating, tags } = generateTasteProfile(brewParams.extraction, bean.origin, bean.roastLevel)

  // Brew timestamp: random minute in Wei Liang's morning window
  const sgNow = singaporeNow()
  const [hourMin, hourMax] = PERSONA.brewHourRange
  const brewHour = hourMin + Math.floor(Math.random() * (hourMax - hourMin + 1))
  const brewDate = new Date(sgNow)
  brewDate.setHours(brewHour, Math.floor(Math.random() * 60), 0, 0)

  // Notes: AI-generated with rule-based fallback
  const aiNotes = await generateBrewNotes({
    beanName: bean.name, origin: bean.origin, method: params.method,
    ...brewParams, rating, tags,
  })
  const notes = aiNotes ?? generateFallbackNotes(bean.name, params.method, rating, tags, brewParams.extraction)

  const brewPayload: Omit<AgentBrew, 'id'> = {
    beanId: bean.id,
    beanName: bean.name,
    method: params.method,
    dose: brewParams.dose,
    water: brewParams.water,
    temp: brewParams.temp,
    ratio: formatRatio(brewParams.dose, brewParams.water),
    grindSize: brewParams.grindSize,
    brewTime: brewParams.brewTime,
    rating,
    tasteTags: tags,
    notes,
    date: brewDate.toISOString(),
    extraction: brewParams.extraction,
  }

  if (!isDryRun) {
    await insertBrew(userId, brewPayload)
    const newRemaining = Math.max(0, bean.remainingGrams - brewParams.dose)
    await updateBeanGrams(bean.id, newRemaining)
    log(`Brewed: ${bean.name} via ${params.method} — ${rating}/5 | ${brewParams.extraction}% extraction`)
    log(`  Grind : ${brewParams.grindSize}${params.grindAdjustment && params.grindAdjustment !== 'same' ? ` (adjusted ${params.grindAdjustment})` : ''}`)
    log(`  Tags  : ${tags.join(', ')}`)
    log(`  Notes : "${notes}"`)
    if (params.reasoning) log(`  Why   : ${params.reasoning}`)
    return { success: true, brew: { ...brewPayload, id: 'saved' }, dryRun: false }
  } else {
    log(`[dry] Would brew: ${bean.name} via ${params.method} — ${rating}/5`)
    if (params.reasoning) log(`[dry]   Why: ${params.reasoning}`)
    return { success: true, brew: { ...brewPayload, id: 'dry-run' }, dryRun: true }
  }
}

async function toolValidateData(): Promise<object> {
  const beans = await fetchBeans(userId)
  const brews = await fetchBrews(userId)
  const issues = validateAll(beans, brews)
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  return {
    totalIssues: issues.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: issues.map(i => ({
      severity: i.severity,
      entity: `${i.entityType} "${i.entityName}"`,
      field: i.field,
      message: i.message,
    })),
  }
}

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  log(`  → tool: ${name}(${Object.keys(input).length ? JSON.stringify(input) : ''})`)
  switch (name) {
    case 'get_beans':
      return toolGetBeans()
    case 'get_recent_brews':
      return toolGetRecentBrews((input.limit as number | undefined) ?? 7)
    case 'has_brewed_today':
      return toolHasBrewedToday()
    case 'get_bean_catalog':
      return toolGetCatalog()
    case 'purchase_bean':
      return toolPurchaseBean(input.bean_name as string | undefined)
    case 'save_brew':
      return toolSaveBrew({
        beanId: input.bean_id as string,
        method: input.method as BrewMethod,
        grindAdjustment: input.grind_adjustment as 'finer' | 'coarser' | 'same' | undefined,
        reasoning: input.reasoning as string | undefined,
      })
    case 'validate_data':
      return toolValidateData()
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ---------------------------------------------------------------------------
// Tool schemas exposed to Claude
// ---------------------------------------------------------------------------

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_beans',
    description:
      'Get the current bean inventory. Returns each bean with its name, origin, roast level, ' +
      'remaining grams, days post-roast, freshness label, and low/critical flags.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_recent_brews',
    description:
      'Fetch the last N brew sessions. Use this to spot taste patterns (e.g. consistently bitter), ' +
      'identify grind drift, and check what was brewed recently to avoid repeating the same bean.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'How many brews to fetch (default 7, max 20)' },
      },
      required: [],
    },
  },
  {
    name: 'has_brewed_today',
    description: 'Check whether a brew has already been recorded today. Always call this before save_brew.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_bean_catalog',
    description: 'List all bean varieties available to purchase. Use this to pick which bean to order.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'purchase_bean',
    description:
      'Order a new 200g bag. Call this when a bean is low (≤150g) or critical (≤50g). ' +
      'You can specify a bean from the catalog by name, or omit bean_name to auto-pick one not already in stock.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bean_name: {
          type: 'string',
          description: 'Exact name from the catalog (from get_bean_catalog), or omit for auto-select.',
        },
      },
      required: [],
    },
  },
  {
    name: 'save_brew',
    description:
      'Record today\'s brew. Brew parameters and taste profile are generated automatically — ' +
      'you decide which bean (by id), which method, and whether to adjust the grind based on ' +
      'recent taste tags (sour/thin → finer; bitter/astringent → coarser; good cup → same).',
    input_schema: {
      type: 'object' as const,
      properties: {
        bean_id: {
          type: 'string',
          description: 'The id field of the bean to brew (from get_beans).',
        },
        method: {
          type: 'string',
          enum: ['V60', 'Chemex', 'AeroPress', 'French Press'],
          description: 'Brew method. Follow the day-of-week preference unless there is a good reason not to.',
        },
        grind_adjustment: {
          type: 'string',
          enum: ['finer', 'coarser', 'same'],
          description:
            'Direction to shift the grind vs the base profile. ' +
            'finer = +extraction (good for sour/under-extracted cups); ' +
            'coarser = −extraction (good for bitter/over-extracted cups); ' +
            'same = keep base profile.',
        },
        reasoning: {
          type: 'string',
          description:
            'A sentence or two explaining why you chose this bean, method, and grind. ' +
            'Logged for the run report.',
        },
      },
      required: ['bean_id', 'method'],
    },
  },
  {
    name: 'validate_data',
    description: 'Run data integrity checks on all beans and brews. Call this at the end of every run.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
]

// ---------------------------------------------------------------------------
// Main — agentic loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  sep()
  log(`Artisanal Brew Agent (Loop Mode) — ${PERSONA.name}, ${PERSONA.location}`)
  log(isDryRun ? 'Mode: DRY RUN (no data will be written)' : 'Mode: LIVE')
  sep()

  // Authenticate with Supabase
  await ensureAuth()
  log('Authenticated with Supabase.')

  // Build context for the system prompt
  const sgNow = singaporeNow()
  const today = todayString(sgNow)
  const day = dayName(sgNow)

  const systemPrompt = [
    `You are Wei Liang, a specialty coffee enthusiast in Singapore.`,
    `Every morning you use the Artisanal Brew app to manage your beans and log your brew.`,
    ``,
    `## Your preferences`,
    `- Weekday mornings → V60`,
    `- Saturday mornings → Chemex`,
    `- Sunday mornings → AeroPress`,
    `- Bean freshness sweet spot: 7–28 days post-roast (avoid beans less than 7 days old)`,
    `- Low stock: ≤150g → consider ordering. Critical: ≤50g → must order immediately.`,
    `- You never brew the same bean two days in a row if you have another option in peak freshness.`,
    ``,
    `## Grind adjustment logic`,
    `Look at the last brew with the same bean+method combination:`,
    `- Tags like "Sour", "Thin", "Bright" (or extraction < 19%) → go finer`,
    `- Tags like "Bitter", "Astringent", "Harsh" (or extraction > 23%) → go coarser`,
    `- Good cup with balanced/positive tags → keep same`,
    `If no previous brew exists for this bean+method, use "same" (base profile).`,
    ``,
    `## Your routine (every morning)`,
    `1. Check if you've already brewed today — skip brew if yes`,
    `2. Check bean inventory (stock levels + freshness)`,
    `3. Look at the last 7 brews to understand recent patterns`,
    `4. Purchase beans if any are low/critical (choose wisely from the catalog)`,
    `5. Choose the best bean to brew today, pick the right method for the day, adjust grind`,
    `6. Save the brew`,
    `7. Validate all data`,
    ``,
    `## Today`,
    `It is ${day}, ${today} (Singapore time).`,
    isDryRun ? `This is a DRY RUN — no data will actually be written to the database.` : '',
    ``,
    `Think step by step. Briefly explain your reasoning before each decision.`,
    `When you are done with the full routine, say so clearly.`,
  ].filter(Boolean).join('\n')

  // Initialise the Anthropic client
  const client = new Anthropic()

  let messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: 'Good morning! Time for your daily coffee routine.',
    },
  ]

  // ── Agentic loop ─────────────────────────────────────────────────────────
  let iterations = 0

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    })

    // Print Claude's reasoning text
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        log(`[Claude] ${block.text.trim()}`)
      }
    }

    if (response.stop_reason === 'end_turn') {
      log('Agent signalled completion.')
      break
    }

    if (response.stop_reason !== 'tool_use') {
      log(`Unexpected stop_reason: ${response.stop_reason}`)
      break
    }

    // Execute each tool call and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      let resultContent: string
      let isError = false

      try {
        const result = await executeTool(block.name, block.input as Record<string, unknown>)
        resultContent = JSON.stringify(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log(`  ✗ tool error (${block.name}): ${msg}`)
        resultContent = JSON.stringify({ error: msg })
        isError = true
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: resultContent,
        is_error: isError,
      })
    }

    // Append this turn's assistant response + tool results
    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }

  if (iterations >= MAX_ITERATIONS) {
    log(`WARNING: reached the ${MAX_ITERATIONS}-iteration safety limit.`)
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  sep()
  const toolCallCount = actionsLog.filter(l => l.includes('→ tool:')).length
  log(`Run complete. Total tool calls: ${toolCallCount}`)
  sep()
}

main().catch(err => {
  console.error('Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
