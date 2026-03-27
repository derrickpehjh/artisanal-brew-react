import { createClient } from '@supabase/supabase-js'
import type { AgentBean, AgentBrew } from './types.js'

function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL
  // Prefer service role key (bypasses RLS); fall back to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials.\n' +
      'Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_KEY) in .env'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export const supabase = getSupabaseClient()

// ---------------------------------------------------------------------------
// Beans
// ---------------------------------------------------------------------------

export async function fetchBeans(userId: string): Promise<AgentBean[]> {
  const { data, error } = await supabase
    .from('beans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`fetchBeans: ${error.message}`)

  return (data ?? []).map(r => ({
    id: r.id as string,
    name: r.name as string,
    origin: r.origin as string,
    process: r.process as string,
    roastLevel: r.roast_level as string,
    roastDate: r.roast_date as string | null,
    totalGrams: r.total_grams as number,
    remainingGrams: r.remaining_grams as number,
    notes: r.notes as string,
  }))
}

export async function insertBean(
  userId: string,
  bean: Omit<AgentBean, 'id'>
): Promise<AgentBean> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('beans').insert({
    id,
    user_id: userId,
    name: bean.name,
    origin: bean.origin,
    process: bean.process,
    roast_level: bean.roastLevel,
    roast_date: bean.roastDate,
    total_grams: bean.totalGrams,
    remaining_grams: bean.remainingGrams,
    notes: bean.notes,
  })
  if (error) throw new Error(`insertBean: ${error.message}`)
  return { id, ...bean }
}

export async function updateBeanGrams(id: string, remainingGrams: number): Promise<void> {
  const { error } = await supabase
    .from('beans')
    .update({ remaining_grams: remainingGrams })
    .eq('id', id)
  if (error) throw new Error(`updateBeanGrams: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Brews
// ---------------------------------------------------------------------------

export async function fetchBrews(userId: string, limit = 100): Promise<AgentBrew[]> {
  const { data, error } = await supabase
    .from('brews')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`fetchBrews: ${error.message}`)

  return (data ?? []).map(r => ({
    id: r.id as string,
    beanId: r.bean_id as string | null,
    beanName: r.bean_name as string,
    method: r.method as string,
    dose: r.dose as number,
    water: r.water as number,
    temp: r.temp as number,
    ratio: r.ratio as string,
    grindSize: r.grind_size as string,
    brewTime: r.brew_time as string,
    rating: r.rating as number,
    tasteTags: (r.taste_tags as string[]) ?? [],
    notes: r.notes as string,
    date: r.date as string,
    extraction: r.extraction as number | null,
  }))
}

export async function insertBrew(
  userId: string,
  brew: Omit<AgentBrew, 'id'>
): Promise<AgentBrew> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('brews').insert({
    id,
    user_id: userId,
    bean_id: brew.beanId ?? null,
    bean_name: brew.beanName,
    method: brew.method,
    dose: brew.dose,
    water: brew.water,
    temp: brew.temp,
    ratio: brew.ratio,
    grind_size: brew.grindSize,
    brew_time: brew.brewTime,
    rating: brew.rating,
    taste_tags: brew.tasteTags,
    notes: brew.notes,
    date: brew.date,
    extraction: brew.extraction,
  })
  if (error) throw new Error(`insertBrew: ${error.message}`)
  return { id, ...brew }
}
