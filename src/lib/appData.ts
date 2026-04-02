import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Bean, BeanDbRow } from '../types/bean'
import type { Brew, BrewDbRow, BrewStats, BrewPhase, PhasesMap } from '../types/brew'

let _beans: Bean[] = []
let _brews: Brew[] = []
let _user: User | null = null

const DB_TIMEOUT_MS = 12000

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise as Promise<T>, timeout]).finally(() => clearTimeout(timer))
}

type DbWriteResult = { error: { message: string } | null }
type DbReadResult<T> = { data: T | null; error: { message: string } | null }

async function dbTimeout<T>(
  query: PromiseLike<{ data: T | null; error: unknown }>,
  timeoutMs: number,
  message: string
): Promise<DbReadResult<T>> {
  return withTimeout(query as PromiseLike<DbReadResult<T>>, timeoutMs, message)
}

async function dbWriteTimeout(
  query: PromiseLike<{ error: unknown }>,
  timeoutMs: number,
  message: string
): Promise<DbWriteResult> {
  return withTimeout(query, timeoutMs, message) as Promise<DbWriteResult>
}

function normalizeBeanPayload(bean: Partial<Bean>): Bean {
  return {
    id: bean.id ?? crypto.randomUUID(),
    name: String(bean?.name || '').trim(),
    origin: String(bean?.origin || '').trim(),
    process: String(bean?.process || '').trim(),
    roastLevel: String(bean?.roastLevel || '').trim() || 'Medium',
    roastDate: bean?.roastDate ?? null,
    notes: String(bean?.notes || '').trim(),
    totalGrams: Number(bean?.totalGrams),
    remainingGrams: Number(bean?.remainingGrams),
    communityRating: bean?.communityRating ?? null,
    communityReviews: bean?.communityReviews ?? null,
  }
}

// DB mappers
export const beanFromDb = (r: BeanDbRow): Bean => ({
  id: r.id, name: r.name, origin: r.origin, process: r.process,
  roastLevel: r.roast_level, roastDate: r.roast_date,
  totalGrams: r.total_grams, remainingGrams: r.remaining_grams,
  notes: r.notes, communityRating: r.community_rating,
  communityReviews: r.community_reviews,
})

export const beanToDb = (b: Bean, userId: string): BeanDbRow => ({
  id: b.id, user_id: userId, name: b.name, origin: b.origin,
  process: b.process, roast_level: b.roastLevel, roast_date: b.roastDate,
  total_grams: b.totalGrams, remaining_grams: b.remainingGrams,
  notes: b.notes, community_rating: b.communityRating ?? null,
  community_reviews: b.communityReviews ?? null,
})

export const brewFromDb = (r: BrewDbRow): Brew => ({
  id: r.id, beanId: r.bean_id ?? undefined, beanName: r.bean_name, method: r.method,
  dose: r.dose, water: r.water, temp: r.temp, ratio: r.ratio,
  grindSize: r.grind_size, brewTime: r.brew_time, rating: r.rating,
  tasteTags: r.taste_tags || [], notes: r.notes, date: r.date,
  extraction: r.extraction,
})

export const brewToDb = (b: Brew, userId: string): BrewDbRow => ({
  id: b.id, user_id: userId, bean_id: b.beanId ?? null, bean_name: b.beanName,
  method: b.method, dose: b.dose, water: b.water, temp: b.temp,
  ratio: b.ratio, grind_size: b.grindSize, brew_time: b.brewTime,
  rating: b.rating, taste_tags: b.tasteTags || [], notes: b.notes,
  date: b.date, extraction: b.extraction ?? null,
})


function cacheKey(kind: string): string {
  return `artisanal_${kind}_${_user?.id || 'anon'}`
}

function saveLocalSnapshot(): void {
  try {
    localStorage.setItem(cacheKey('beans'), JSON.stringify(_beans))
    localStorage.setItem(cacheKey('brews'), JSON.stringify(_brews))
  } catch (e) { console.warn('Local cache write failed:', (e as Error)?.message) }
}

function loadLocalSnapshot(): boolean {
  try {
    const beans = JSON.parse(localStorage.getItem(cacheKey('beans')) || 'null') as Bean[] | null
    const brews = JSON.parse(localStorage.getItem(cacheKey('brews')) || 'null') as Brew[] | null
    if (!Array.isArray(beans) || !Array.isArray(brews)) return false
    _beans = beans; _brews = brews; return true
  } catch { return false }
}

function relativeRoastDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000)
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}, ${d.getFullYear()}`
}

function seedBeans(userId: string): BeanDbRow[] {
  return [
    { id: crypto.randomUUID(), user_id: userId, name: 'Ethiopia Yirgacheffe', origin: 'Ethiopia', process: 'Washed Process', roast_level: 'Light-Medium', roast_date: relativeRoastDate(10), total_grams: 250, remaining_grams: 162, notes: 'Floral jasmine notes with a bright citrus finish.', community_rating: 4.8, community_reviews: 1200 },
    { id: crypto.randomUUID(), user_id: userId, name: 'Colombia Huila', origin: 'Colombia', process: 'Honey Process', roast_level: 'Medium', roast_date: relativeRoastDate(17), total_grams: 200, remaining_grams: 45, notes: 'Caramel sweetness, smooth and balanced finish.', community_rating: 4.5, community_reviews: 890 },
    { id: crypto.randomUUID(), user_id: userId, name: 'Kenya Nyeri', origin: 'Kenya', process: 'Natural Process', roast_level: 'Light', roast_date: relativeRoastDate(21), total_grams: 250, remaining_grams: 210, notes: 'Bright berry acidity with a wine-like finish.', community_rating: 4.7, community_reviews: 650 },
    { id: crypto.randomUUID(), user_id: userId, name: 'Guatemala Huehuetenango', origin: 'Guatemala', process: 'Washed Process', roast_level: 'Medium', roast_date: relativeRoastDate(32), total_grams: 500, remaining_grams: 380, notes: 'Dark chocolate and brown sugar, clean finish.', community_rating: 4.6, community_reviews: 420 },
  ]
}

function seedBrews(userId: string, beanIds: string[]): BrewDbRow[] {
  const [b1, b2, b3, b4] = beanIds
  const now = Date.now()
  return [
    { id: crypto.randomUUID(), user_id: userId, bean_id: b1, bean_name: 'Ethiopia Yirgacheffe', method: 'V60', dose: 18.2, water: 300, temp: 94, ratio: '1:16.5', grind_size: 'Medium-Fine (22)', brew_time: '3:12', rating: 4, taste_tags: ['Floral', 'Bright'], notes: 'Slightly over-extracted at the finish.', date: new Date(now - 86400000).toISOString(), extraction: 20.4 },
    { id: crypto.randomUUID(), user_id: userId, bean_id: b4, bean_name: 'Guatemala Huehuetenango', method: 'AeroPress', dose: 18, water: 250, temp: 93, ratio: '1:13.9', grind_size: 'Medium', brew_time: '2:30', rating: 4, taste_tags: ['Balanced', 'Nutty'], notes: 'Perfect extraction.', date: new Date(now - 10800000).toISOString(), extraction: 22.1 },
    { id: crypto.randomUUID(), user_id: userId, bean_id: b2, bean_name: 'Colombia Huila', method: 'Espresso', dose: 18, water: 36, temp: 93, ratio: '1:2', grind_size: 'Fine', brew_time: '0:28', rating: 3, taste_tags: ['Bright', 'Slightly Sour'], notes: 'Slightly sour. Under-extracted.', date: new Date(now - 86400000 * 1.5).toISOString(), extraction: 18.5 },
    { id: crypto.randomUUID(), user_id: userId, bean_id: b3, bean_name: 'Kenya Nyeri', method: 'French Press', dose: 30, water: 500, temp: 93, ratio: '1:16.7', grind_size: 'Coarse', brew_time: '4:00', rating: 5, taste_tags: ['Rich Body', 'Earthy'], notes: 'Rich body, full and satisfying.', date: new Date(now - 86400000 * 3).toISOString(), extraction: 19.8 },
    { id: crypto.randomUUID(), user_id: userId, bean_id: b1, bean_name: 'Ethiopia Yirgacheffe', method: 'V60', dose: 18.5, water: 296, temp: 92, ratio: '1:16', grind_size: '24 clicks (Comandante)', brew_time: '3:18', rating: 5, taste_tags: ['Floral', 'Balanced', 'Juicy'], notes: 'Best V60 yet.', date: new Date(now - 86400000 * 7).toISOString(), extraction: 22.1 },
    { id: crypto.randomUUID(), user_id: userId, bean_id: b1, bean_name: 'Ethiopia Yirgacheffe', method: 'V60', dose: 18, water: 288, temp: 94, ratio: '1:16', grind_size: '23 clicks', brew_time: '3:05', rating: 4, taste_tags: ['Floral', 'Bright'], notes: 'Good but slightly thin body.', date: new Date(now - 86400000 * 10).toISOString(), extraction: 21.0 },
    { id: crypto.randomUUID(), user_id: userId, bean_id: b3, bean_name: 'Kenya Nyeri', method: 'Chemex', dose: 25, water: 400, temp: 95, ratio: '1:16', grind_size: 'Medium-Coarse', brew_time: '4:30', rating: 5, taste_tags: ['Bright', 'Juicy', 'Berry'], notes: 'Outstanding.', date: new Date(now - 86400000 * 14).toISOString(), extraction: 21.5 },
    { id: crypto.randomUUID(), user_id: userId, bean_id: b2, bean_name: 'Colombia Huila', method: 'V60', dose: 17, water: 272, temp: 93, ratio: '1:16', grind_size: 'Medium (20)', brew_time: '3:00', rating: 3, taste_tags: ['Balanced', 'Caramel'], notes: 'Decent but not remarkable.', date: new Date(now - 86400000 * 18).toISOString(), extraction: 19.2 },
  ]
}

export async function loadData(user: User): Promise<{ beans: Bean[]; brews: Brew[] }> {
  _user = user
  try {
    if (!isSupabaseConfigured || !supabase) {
      if (!loadLocalSnapshot()) { _beans = []; _brews = [] }
      return { beans: _beans, brews: _brews }
    }

    const [{ data: beans, error: beansErr }, { data: brews, error: brewsErr }] = await Promise.all([
      dbTimeout<BeanDbRow[]>(supabase.from('beans').select('*').eq('user_id', user.id).order('created_at') as PromiseLike<{ data: BeanDbRow[] | null; error: unknown }>, DB_TIMEOUT_MS, 'Loading beans timed out'),
      dbTimeout<BrewDbRow[]>(supabase.from('brews').select('*').eq('user_id', user.id).order('date', { ascending: false }) as PromiseLike<{ data: BrewDbRow[] | null; error: unknown }>, DB_TIMEOUT_MS, 'Loading brews timed out'),
    ])
    if (beansErr || brewsErr) throw new Error([beansErr?.message, brewsErr?.message].filter(Boolean).join(' | '))

    if (!beans || beans.length === 0) {
      const sb = seedBeans(user.id)
      const beanIds = sb.map(b => b.id)
      const sbr = seedBrews(user.id, beanIds)
      const [{ error: seedBeansErr }, { error: seedBrewsErr }] = await Promise.all([
        Promise.resolve(supabase.from('beans').insert(sb)),
        Promise.resolve(supabase.from('brews').insert(sbr)),
      ])
      if (seedBeansErr) throw new Error('Seed failed: ' + seedBeansErr.message)
      if (seedBrewsErr) throw new Error('Seed failed: ' + seedBrewsErr.message)
      _beans = sb.map(beanFromDb); _brews = sbr.map(brewFromDb)
    } else {
      _beans = (beans as BeanDbRow[]).map(beanFromDb)
      _brews = ((brews || []) as BrewDbRow[]).map(brewFromDb)
    }
    saveLocalSnapshot()
  } catch (e) {
    if (!loadLocalSnapshot()) throw e
  }
  return { beans: _beans, brews: _brews }
}

export function setUser(user: User | null): void { _user = user }
export function clearLocalSnapshot(): void {
  try {
    localStorage.removeItem(cacheKey('beans'))
    localStorage.removeItem(cacheKey('brews'))
  } catch { /* ignore */ }
}
export function getBeans(): Bean[] { return _beans }
export function getBrews(): Brew[] { return [..._brews].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }

function validateBean(bean: Bean): void {
  if (!bean.name) throw new Error('Bean name is required.')
  if (!bean.origin) throw new Error('Origin is required.')
  if (!Number.isFinite(bean.totalGrams) || bean.totalGrams <= 0) throw new Error('Total grams must be greater than 0.')
  if (!Number.isFinite(bean.remainingGrams) || bean.remainingGrams < 0) throw new Error('Remaining grams must be 0 or higher.')
  if (bean.remainingGrams > bean.totalGrams) throw new Error('Remaining grams cannot exceed total grams.')
}

export async function addBean(bean: Partial<Bean>): Promise<Bean> {
  const normalized = normalizeBeanPayload(bean)
  validateBean(normalized)

  if (_user && isSupabaseConfigured && supabase) {
    const { error } = await dbWriteTimeout(
      supabase.from('beans').insert(beanToDb(normalized, _user.id)),
      DB_TIMEOUT_MS,
      'Save bean request timed out. Please check your connection and try again.'
    )
    if (error) throw new Error(error.message || 'Failed to save bean')
  }
  _beans.push(normalized)
  saveLocalSnapshot()
  return normalized
}

export async function updateBean(id: string, data: Partial<Bean>): Promise<Bean | undefined> {
  const idx = _beans.findIndex(b => b.id === id)
  if (idx === -1) return undefined

  const prev = _beans[idx]
  const merged = normalizeBeanPayload({ ...prev, ...data })
  validateBean(merged)

  if (_user && isSupabaseConfigured && supabase) {
    const { error } = await dbWriteTimeout(
      supabase.from('beans').update(beanToDb(merged, _user.id)).eq('id', id).eq('user_id', _user.id),
      DB_TIMEOUT_MS,
      'Update bean request timed out. Please check your connection and try again.'
    )
    if (error) throw new Error(error.message || 'Failed to update bean')
  }

  _beans[idx] = merged
  saveLocalSnapshot()
  return _beans[idx]
}

export async function deleteBean(id: string): Promise<Bean | undefined> {
  const idx = _beans.findIndex(b => b.id === id)
  if (idx === -1) return undefined

  const removedBean = _beans[idx]
  const prevBrews = _brews

  _beans.splice(idx, 1)
  _brews = _brews.map((brew) => (
    brew.beanId === id
      ? { ...brew, beanId: undefined, beanName: brew.beanName || removedBean.name }
      : brew
  ))

  if (_user && isSupabaseConfigured && supabase) {
    try {
      const { error: brewsErr } = await supabase
        .from('brews')
        .update({ bean_id: null })
        .eq('bean_id', id)
        .eq('user_id', _user.id)
      if (brewsErr) throw new Error(brewsErr.message || 'Failed to detach brews from bean')

      const { error } = await supabase
        .from('beans')
        .delete()
        .eq('id', id)
        .eq('user_id', _user.id)
      if (error) throw new Error(error.message || 'Failed to delete bean')
    } catch (e) {
      _beans.splice(idx, 0, removedBean)
      _brews = prevBrews
      throw e
    }
  }

  saveLocalSnapshot()
  return removedBean
}

export async function saveBrew(brew: Partial<Brew>): Promise<Brew> {
  if (!_user) throw new Error('Not authenticated.')
  const payload: Brew = {
    ...brew,
    id: brew.id || crypto.randomUUID(),
    date: brew.date || new Date().toISOString(),
    beanName: brew.beanName || 'Unknown Bean',
    method: brew.method || 'V60',
    ratio: brew.ratio || formatRatio(brew.dose ?? 18, brew.water ?? 300),
    grindSize: brew.grindSize || '24 clicks',
    brewTime: brew.brewTime || '3:15',
    rating: Number.isFinite(brew.rating) ? brew.rating! : 3,
    tasteTags: Array.isArray(brew.tasteTags) ? brew.tasteTags : [],
    dose: brew.dose ?? 18,
    water: brew.water ?? 300,
    temp: brew.temp ?? 94,
    notes: brew.notes ?? '',
  }
  if (!payload.beanId && payload.beanName) {
    const bean = _beans.find(b => b.name === payload.beanName)
    if (bean) payload.beanId = bean.id
  }
  if (!payload.beanName && payload.beanId) {
    const bean = _beans.find(b => b.id === payload.beanId)
    if (bean) payload.beanName = bean.name
  }
  if (!supabase) throw new Error('Supabase not configured')
  const { error: brewErr } = await supabase.from('brews').insert(brewToDb(payload, _user.id))
  if (brewErr) throw new Error(brewErr.message || 'Unable to save brew')
  _brews.push(payload)
  if (payload.beanId) {
    const bean = _beans.find(b => b.id === payload.beanId)
    if (bean) {
      bean.remainingGrams = Math.max(0, bean.remainingGrams - Math.round(payload.dose))
      await supabase.from('beans').update({ remaining_grams: bean.remainingGrams }).eq('id', bean.id).eq('user_id', _user.id)
    }
  }
  localStorage.removeItem('artisanal_pending_brew')
  return payload
}

// Recalculates extraction for brews saved with the old inverted formula (dose/water)*100*1.2.
// Those brews have extraction values < 15 (old formula caps out ~10% for typical ratios).
// The correct formula is (water/dose)*1.2, producing 18-22% for typical filter ratios.
export async function migrateExtractionValues(): Promise<number> {
  const stale = _brews.filter(b => b.extraction != null && b.extraction > 0 && b.extraction < 15)
  if (!stale.length) return 0

  const updates = stale.map(b => ({
    brew: b,
    newExtraction: Number(((b.water / b.dose) * 1.2).toFixed(1)),
  }))

  if (_user && isSupabaseConfigured && supabase) {
    await Promise.all(updates.map(({ brew, newExtraction }) =>
      supabase!.from('brews').update({ extraction: newExtraction }).eq('id', brew.id).eq('user_id', _user!.id)
    ))
  }

  // Update in-memory cache
  for (const { brew, newExtraction } of updates) {
    const idx = _brews.findIndex(b => b.id === brew.id)
    if (idx !== -1) _brews[idx] = { ..._brews[idx], extraction: newExtraction }
  }
  return updates.length
}

export async function resetAllData(userId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await Promise.all([
      supabase.from('brews').delete().eq('user_id', userId),
      supabase.from('beans').delete().eq('user_id', userId),
    ])
  }
  _beans = []; _brews = []
  localStorage.removeItem('artisanal_pending_brew')
  localStorage.removeItem('artisanal_active_bean')
  localStorage.removeItem(cacheKey('beans'))
  localStorage.removeItem(cacheKey('brews'))
}

// Target extraction range for all brew methods (SCA standard)
const EXTRACTION_MIN = 18
const EXTRACTION_MAX = 22

export function getStats(_beans: Bean[], brews: Brew[]): BrewStats {
  const empty = { avgRating: 0, totalBrews: 0, consistencyPct: 0, weeklyVolumeLiters: 0, trendPct: 0, avgExtraction: null, extractionInRange: 0 }
  if (!brews.length) return empty
  const sorted = [...brews].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const avg = brews.reduce((s, b) => s + b.rating, 0) / brews.length
  const weekAgo = Date.now() - 7 * 86400000
  const prevWeekAgo = weekAgo - 7 * 86400000
  const weekly = brews.filter(b => new Date(b.date).getTime() > weekAgo)
  const prevWeekly = brews.filter(b => { const t = new Date(b.date).getTime(); return t > prevWeekAgo && t <= weekAgo })
  const vol = weekly.reduce((s, b) => s + b.water, 0) / 1000
  const last7 = sorted.slice(0, 7)

  // Extraction stats: use actual extraction % where available
  const brewsWithExtraction = last7.filter(b => b.extraction != null && b.extraction > 0)
  const avgExtraction = brewsWithExtraction.length
    ? Number((brewsWithExtraction.reduce((s, b) => s + b.extraction!, 0) / brewsWithExtraction.length).toFixed(1))
    : null
  const extractionInRange = brewsWithExtraction.length
    ? Math.round((brewsWithExtraction.filter(b => b.extraction! >= EXTRACTION_MIN && b.extraction! <= EXTRACTION_MAX).length / brewsWithExtraction.length) * 100)
    : 0

  // Consistency: % of last 7 brews with extraction in target range (falls back to rating >= 3 if no extraction data)
  const consistencyPct = brewsWithExtraction.length
    ? extractionInRange
    : last7.length ? Math.round((last7.filter(b => b.rating >= 3).length / last7.length) * 100) : 0

  // trendPct: compare avg rating this week vs previous week (not brew count)
  const weeklyAvg = weekly.length ? weekly.reduce((s, b) => s + b.rating, 0) / weekly.length : 0
  const prevAvg = prevWeekly.length ? prevWeekly.reduce((s, b) => s + b.rating, 0) / prevWeekly.length : 0
  const trendPct = prevAvg > 0 ? Math.round(((weeklyAvg - prevAvg) / prevAvg) * 100) : 0

  return { avgRating: Number(avg.toFixed(1)), totalBrews: brews.length, consistencyPct, weeklyVolumeLiters: Number(vol.toFixed(1)), trendPct, avgExtraction, extractionInRange }
}

// Utilities
export function formatDate(iso: string): string {
  const d = new Date(iso), now = new Date()
  const hrs = (now.getTime() - d.getTime()) / 3600000
  const t = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (hrs < 24) return `Today, ${t}`
  if (hrs < 48) return `Yesterday, ${t}`
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}, ${t}`
}
export function formatRatio(dose: number, water: number): string {
  if (!dose || !water) return '—'
  return `1:${(water / dose).toFixed(1)}`
}
export function formatTime(secs: number): string {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

export const PHASES: PhasesMap = {
  'V60': [
    { name: 'Bloom Pour', icon: 'water_drop', targetWater: 40, duration: 15, instruction: 'Pour the bloom water in a slow spiral from centre outward, fully saturating all the grounds.' },
    { name: 'Bloom Rest', icon: 'hourglass_top', targetWater: 40, duration: 35, instruction: 'Set the kettle down and wait. CO₂ bubbling out is normal — let the bed degas completely before the next pour.' },
    { name: 'First Pour', icon: 'water_drop', targetWater: 120, duration: 45, instruction: 'Pour steadily in slow concentric circles, maintaining gentle even saturation across all grounds.' },
    { name: 'Second Pour', icon: 'water_drop', targetWater: 220, duration: 45, instruction: 'Continue pouring until the target, keeping the stream slow and steady from the centre outward.' },
    { name: 'Draw Down', icon: 'hourglass_bottom', targetWater: 0, duration: 75, instruction: 'Allow the brew to fully drain. Do not disturb the bed.' },
  ],
  'Chemex': [
    { name: 'Bloom Pour', icon: 'water_drop', targetWater: 60, duration: 20, instruction: 'Pre-wet the filter, then pour the bloom water in a slow spiral, saturating all grounds evenly.' },
    { name: 'Bloom Rest', icon: 'hourglass_top', targetWater: 60, duration: 40, instruction: 'Wait for the grounds to degas. You will see the crust rise and CO₂ escape — this unlocks clarity in the cup.' },
    { name: 'First Pour', icon: 'water_drop', targetWater: 200, duration: 60, instruction: 'Pour slowly without disturbing the coffee crust. The Chemex requires patience.' },
    { name: 'Final Pour', icon: 'water_drop', targetWater: 400, duration: 60, instruction: 'Add the remaining water to reach the target. Pour from high for clarity.' },
    { name: 'Draw Down', icon: 'hourglass_bottom', targetWater: 0, duration: 120, instruction: 'Allow the full draw down. Do not squeeze or disturb the filter.' },
  ],
  'AeroPress': [
    { name: 'Fill & Steep', icon: 'water_drop', targetWater: 200, duration: 60, instruction: 'Add all the water. Stir 3 times vigorously to saturate all grounds. Place the cap on top to retain heat.' },
    { name: 'Press', icon: 'compress', targetWater: 0, duration: 30, instruction: 'Press slowly and evenly for 20–30 seconds. Stop pressing when you hear the hiss.' },
  ],
  'French Press': [
    { name: 'Bloom Pour', icon: 'water_drop', targetWater: 60, duration: 15, instruction: 'Add the bloom water and gently stir to fully saturate all the grounds.' },
    { name: 'Bloom Rest', icon: 'hourglass_top', targetWater: 60, duration: 30, instruction: 'Wait for the grounds to degas before adding the rest of the water.' },
    { name: 'Fill', icon: 'water_drop', targetWater: 500, duration: 60, instruction: 'Fill to the target. Place the lid on top (plunger up) without pressing down.' },
    { name: 'Steep', icon: 'hourglass_bottom', targetWater: 0, duration: 240, instruction: 'Wait 4 full minutes. Resist the urge to stir — it causes over-extraction.' },
    { name: 'Press & Pour', icon: 'compress', targetWater: 0, duration: 30, instruction: 'Press the plunger down slowly and evenly, then pour immediately to stop extraction.' },
  ],
}

export const TIPS: string[] = [
  'Try lowering your bloom temperature by 2°C — it can unlock more floral aromatics in light-roast washed coffees.',
  'Consistency in pour rate matters more than speed. A gooseneck kettle at 3–4g/s produces the most even extraction.',
  'Freshness peak for most specialty beans is 7–21 days post-roast. Track your roast dates to hit that window.',
  'A coarser grind with slower pour compensates for very dense, high-altitude beans and reduces over-extraction risk.',
  'Pre-heating your V60 and cup with hot water can improve brew temperature stability by up to 3°C.',
]

export function getTip(): string { return TIPS[new Date().getDate() % TIPS.length] }

export function getPhases(method: string, water?: number): BrewPhase[] {
  const base = PHASES[method as keyof PhasesMap] || PHASES['V60']
  if (!water) return base
  const maxWater = Math.max(...base.map(p => p.targetWater))
  if (!maxWater) return base
  const scale = water / maxWater
  return base.map(p => ({
    ...p,
    targetWater: p.targetWater > 0 ? Math.round(p.targetWater * scale) : 0,
  }))
}

// Pending brew (localStorage)
export function getPendingBrew(): Partial<Brew> | null {
  try { return JSON.parse(localStorage.getItem('artisanal_pending_brew') || 'null') as Partial<Brew> | null }
  catch { return null }
}
export function setPendingBrew(brew: Partial<Brew>): void { localStorage.setItem('artisanal_pending_brew', JSON.stringify(brew)) }
export function clearPendingBrew(): void { localStorage.removeItem('artisanal_pending_brew') }
export function getActiveBeanId(): string | null { return localStorage.getItem('artisanal_active_bean') }
export function setActiveBeanId(id: string): void { localStorage.setItem('artisanal_active_bean', id) }
