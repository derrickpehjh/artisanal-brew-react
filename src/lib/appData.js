import { supabase } from './supabase'

let _beans = []
let _brews = []
let _user = null

const DB_TIMEOUT_MS = 12000

function withTimeout(promise, timeoutMs, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function normalizeBeanPayload(bean) {
  return {
    ...bean,
    name: String(bean?.name || '').trim(),
    origin: String(bean?.origin || '').trim(),
    process: String(bean?.process || '').trim(),
    roastLevel: String(bean?.roastLevel || '').trim() || 'Medium',
    roastDate: bean?.roastDate || null,
    notes: String(bean?.notes || '').trim(),
    totalGrams: Number(bean?.totalGrams),
    remainingGrams: Number(bean?.remainingGrams),
  }
}

// DB mappers
export const beanFromDb = r => ({
  id: r.id, name: r.name, origin: r.origin, process: r.process,
  roastLevel: r.roast_level, roastDate: r.roast_date,
  totalGrams: r.total_grams, remainingGrams: r.remaining_grams,
  notes: r.notes, communityRating: r.community_rating,
  communityReviews: r.community_reviews,
})

export const beanToDb = (b, userId) => ({
  id: b.id, user_id: userId, name: b.name, origin: b.origin,
  process: b.process, roast_level: b.roastLevel, roast_date: b.roastDate,
  total_grams: b.totalGrams, remaining_grams: b.remainingGrams,
  notes: b.notes, community_rating: b.communityRating,
  community_reviews: b.communityReviews,
})

export const brewFromDb = r => ({
  id: r.id, beanId: r.bean_id, beanName: r.bean_name, method: r.method,
  dose: r.dose, water: r.water, temp: r.temp, ratio: r.ratio,
  grindSize: r.grind_size, brewTime: r.brew_time, rating: r.rating,
  tasteTags: r.taste_tags || [], notes: r.notes, date: r.date,
  extraction: r.extraction,
})

export const brewToDb = (b, userId) => ({
  id: b.id, user_id: userId, bean_id: b.beanId, bean_name: b.beanName,
  method: b.method, dose: b.dose, water: b.water, temp: b.temp,
  ratio: b.ratio, grind_size: b.grindSize, brew_time: b.brewTime,
  rating: b.rating, taste_tags: b.tasteTags || [], notes: b.notes,
  date: b.date, extraction: b.extraction,
})

function cacheKey(kind) {
  return `artisanal_${kind}_${_user?.id || 'anon'}`
}

function saveLocalSnapshot() {
  try {
    localStorage.setItem(cacheKey('beans'), JSON.stringify(_beans))
    localStorage.setItem(cacheKey('brews'), JSON.stringify(_brews))
  } catch (e) { console.warn('Local cache write failed:', e?.message) }
}

function loadLocalSnapshot() {
  try {
    const beans = JSON.parse(localStorage.getItem(cacheKey('beans')) || 'null')
    const brews = JSON.parse(localStorage.getItem(cacheKey('brews')) || 'null')
    if (!Array.isArray(beans) || !Array.isArray(brews)) return false
    _beans = beans; _brews = brews; return true
  } catch { return false }
}

function seedBeans(userId) {
  return [
    { id:crypto.randomUUID(), user_id:userId, name:'Ethiopia Yirgacheffe', origin:'Ethiopia', process:'Washed Process', roast_level:'Light-Medium', roast_date:'Oct 12, 2023', total_grams:250, remaining_grams:162, notes:'Floral jasmine notes with a bright citrus finish.', community_rating:4.8, community_reviews:1200 },
    { id:crypto.randomUUID(), user_id:userId, name:'Colombia Huila', origin:'Colombia', process:'Honey Process', roast_level:'Medium', roast_date:'Oct 05, 2023', total_grams:200, remaining_grams:45, notes:'Caramel sweetness, smooth and balanced finish.', community_rating:4.5, community_reviews:890 },
    { id:crypto.randomUUID(), user_id:userId, name:'Kenya Nyeri', origin:'Kenya', process:'Natural Process', roast_level:'Light', roast_date:'Oct 01, 2023', total_grams:250, remaining_grams:210, notes:'Bright berry acidity with a wine-like finish.', community_rating:4.7, community_reviews:650 },
    { id:crypto.randomUUID(), user_id:userId, name:'Guatemala Huehuetenango', origin:'Guatemala', process:'Washed Process', roast_level:'Medium', roast_date:'Sep 20, 2023', total_grams:500, remaining_grams:380, notes:'Dark chocolate and brown sugar, clean finish.', community_rating:4.6, community_reviews:420 },
  ]
}

function seedBrews(userId, beanIds) {
  const [b1, b2, b3, b4] = beanIds
  const now = Date.now()
  return [
    { id:crypto.randomUUID(), user_id:userId, bean_id:b1, bean_name:'Ethiopia Yirgacheffe', method:'V60', dose:18.2, water:300, temp:94, ratio:'1:16.5', grind_size:'Medium-Fine (22)', brew_time:'3:12', rating:4, taste_tags:['Floral','Bright'], notes:'Slightly over-extracted at the finish. May need to coarsen the grind by one notch.', date:new Date(now-86400000).toISOString(), extraction:20.4 },
    { id:crypto.randomUUID(), user_id:userId, bean_id:b4, bean_name:'Guatemala Huehuetenango', method:'AeroPress', dose:18, water:250, temp:93, ratio:'1:13.9', grind_size:'Medium', brew_time:'2:30', rating:4, taste_tags:['Balanced','Nutty'], notes:'Perfect extraction. Clean and sweet with notes of brown sugar.', date:new Date(now-10800000).toISOString(), extraction:22.1 },
    { id:crypto.randomUUID(), user_id:userId, bean_id:b2, bean_name:'Colombia Huila', method:'Espresso', dose:18, water:36, temp:93, ratio:'1:2', grind_size:'Fine', brew_time:'0:28', rating:3, taste_tags:['Bright','Slightly Sour'], notes:'Slightly sour. Under-extracted.', date:new Date(now-86400000*1.5).toISOString(), extraction:18.5 },
    { id:crypto.randomUUID(), user_id:userId, bean_id:b3, bean_name:'Kenya Nyeri', method:'French Press', dose:30, water:500, temp:93, ratio:'1:16.7', grind_size:'Coarse', brew_time:'4:00', rating:5, taste_tags:['Rich Body','Earthy'], notes:'Rich body, full and satisfying.', date:new Date(now-86400000*3).toISOString(), extraction:19.8 },
    { id:crypto.randomUUID(), user_id:userId, bean_id:b1, bean_name:'Ethiopia Yirgacheffe', method:'V60', dose:18.5, water:296, temp:92, ratio:'1:16', grind_size:'24 clicks (Comandante)', brew_time:'3:18', rating:5, taste_tags:['Floral','Balanced','Juicy'], notes:'Best V60 yet. Perfect bloom at 92°C unlocked incredible florals.', date:new Date(now-86400000*7).toISOString(), extraction:22.1 },
    { id:crypto.randomUUID(), user_id:userId, bean_id:b1, bean_name:'Ethiopia Yirgacheffe', method:'V60', dose:18, water:288, temp:94, ratio:'1:16', grind_size:'23 clicks', brew_time:'3:05', rating:4, taste_tags:['Floral','Bright'], notes:'Good but slightly thin body.', date:new Date(now-86400000*10).toISOString(), extraction:21.0 },
    { id:crypto.randomUUID(), user_id:userId, bean_id:b3, bean_name:'Kenya Nyeri', method:'Chemex', dose:25, water:400, temp:95, ratio:'1:16', grind_size:'Medium-Coarse', brew_time:'4:30', rating:5, taste_tags:['Bright','Juicy','Berry'], notes:'Outstanding. Complex and vibrant.', date:new Date(now-86400000*14).toISOString(), extraction:21.5 },
    { id:crypto.randomUUID(), user_id:userId, bean_id:b2, bean_name:'Colombia Huila', method:'V60', dose:17, water:272, temp:93, ratio:'1:16', grind_size:'Medium (20)', brew_time:'3:00', rating:3, taste_tags:['Balanced','Caramel'], notes:'Decent but not remarkable.', date:new Date(now-86400000*18).toISOString(), extraction:19.2 },
    { id:crypto.randomUUID(), user_id:userId, bean_id:b4, bean_name:'Guatemala Huehuetenango', method:'V60', dose:20, water:320, temp:94, ratio:'1:16', grind_size:'25 clicks', brew_time:'3:20', rating:4, taste_tags:['Chocolate','Nutty'], notes:'Solid cup. Chocolate forward with a clean finish.', date:new Date(now-86400000*22).toISOString(), extraction:20.8 },
  ]
}

export async function loadData(user) {
  _user = user
  try {
    const [{ data: beans, error: beansErr }, { data: brews, error: brewsErr }] = await Promise.all([
      supabase.from('beans').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('brews').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    ])
    if (beansErr || brewsErr) throw new Error([beansErr?.message, brewsErr?.message].filter(Boolean).join(' | '))

    if (!beans || beans.length === 0) {
      const sb = seedBeans(user.id)
      const beanIds = sb.map(b => b.id)
      const sbr = seedBrews(user.id, beanIds)
      const [{ error: seedBeansErr }, { error: seedBrewsErr }] = await Promise.all([
        supabase.from('beans').insert(sb),
        supabase.from('brews').insert(sbr),
      ])
      if (seedBeansErr) throw new Error('Seed failed: ' + seedBeansErr.message)
      if (seedBrewsErr) throw new Error('Seed failed: ' + seedBrewsErr.message)
      _beans = sb.map(beanFromDb); _brews = sbr.map(brewFromDb)
    } else {
      _beans = beans.map(beanFromDb); _brews = (brews || []).map(brewFromDb)
    }
    saveLocalSnapshot()
  } catch (e) {
    if (!loadLocalSnapshot()) throw e
  }
  return { beans: _beans, brews: _brews }
}

export function setUser(user) { _user = user }
export function getBeans() { return _beans }
export function getBrews() { return [..._brews].sort((a,b) => new Date(b.date)-new Date(a.date)) }

export async function addBean(bean) {
  const normalized = normalizeBeanPayload(bean)
  if (!normalized.name) throw new Error('Bean name is required.')
  if (!normalized.origin) throw new Error('Origin is required.')
  if (!Number.isFinite(normalized.totalGrams) || normalized.totalGrams <= 0) {
    throw new Error('Total grams must be greater than 0.')
  }
  if (!Number.isFinite(normalized.remainingGrams) || normalized.remainingGrams < 0) {
    throw new Error('Remaining grams must be 0 or higher.')
  }
  if (normalized.remainingGrams > normalized.totalGrams) {
    throw new Error('Remaining grams cannot exceed total grams.')
  }

  normalized.id = normalized.id || crypto.randomUUID()
  if (_user) {
    const { error } = await withTimeout(
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

export async function updateBean(id, data) {
  const idx = _beans.findIndex(b => b.id === id)
  if (idx === -1) return

  const merged = normalizeBeanPayload({ ..._beans[idx], ...data })
  if (!merged.name) throw new Error('Bean name is required.')
  if (!merged.origin) throw new Error('Origin is required.')
  if (!Number.isFinite(merged.totalGrams) || merged.totalGrams <= 0) {
    throw new Error('Total grams must be greater than 0.')
  }
  if (!Number.isFinite(merged.remainingGrams) || merged.remainingGrams < 0) {
    throw new Error('Remaining grams must be 0 or higher.')
  }
  if (merged.remainingGrams > merged.totalGrams) {
    throw new Error('Remaining grams cannot exceed total grams.')
  }

  _beans[idx] = merged
  if (_user) {
    const { error } = await withTimeout(
      supabase.from('beans').update(beanToDb(_beans[idx], _user.id)).eq('id', id).eq('user_id', _user.id),
      DB_TIMEOUT_MS,
      'Update bean request timed out. Please check your connection and try again.'
    )
    if (error) throw new Error(error.message || 'Failed to update bean')
  }
  saveLocalSnapshot()
  return _beans[idx]
}

export async function deleteBean(id) {
  const idx = _beans.findIndex(b => b.id === id)
  if (idx === -1) return

  const removedBean = _beans[idx]
  const prevBrews = _brews

  _beans.splice(idx, 1)
  _brews = _brews.map((brew) => (
    brew.beanId === id
      ? { ...brew, beanId: undefined, beanName: brew.beanName || removedBean.name }
      : brew
  ))
  saveLocalSnapshot()

  if (_user) {
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
      saveLocalSnapshot()
      throw e
    }
  }

  return removedBean
}

export async function saveBrew(brew) {
  if (!_user) throw new Error('Not authenticated.')
  const payload = {
    ...brew,
    id: brew.id || crypto.randomUUID(),
    date: brew.date || new Date().toISOString(),
    beanName: brew.beanName || 'Unknown Bean',
    method: brew.method || 'V60',
    ratio: brew.ratio || formatRatio(brew.dose || 18, brew.water || 300),
    grindSize: brew.grindSize || '24 clicks',
    brewTime: brew.brewTime || '3:15',
    rating: Number.isFinite(brew.rating) ? brew.rating : 3,
    tasteTags: Array.isArray(brew.tasteTags) ? brew.tasteTags : [],
  }
  if (!payload.beanId && payload.beanName) {
    const bean = _beans.find(b => b.name === payload.beanName)
    if (bean) payload.beanId = bean.id
  }
  if (!payload.beanName && payload.beanId) {
    const bean = _beans.find(b => b.id === payload.beanId)
    if (bean) payload.beanName = bean.name
  }
  const { error: brewErr } = await supabase.from('brews').insert(brewToDb(payload, _user.id))
  if (brewErr) throw new Error(brewErr.message || 'Unable to save brew')
  const saved = payload
  _brews.push(saved)
  if (saved.beanId) {
    const bean = _beans.find(b => b.id === saved.beanId)
    if (bean) {
      bean.remainingGrams = Math.max(0, bean.remainingGrams - Math.round(saved.dose || 0))
      await supabase.from('beans').update({ remaining_grams: bean.remainingGrams }).eq('id', bean.id).eq('user_id', _user.id)
    }
  }
  localStorage.removeItem('artisanal_pending_brew')
  saveLocalSnapshot()
  return saved
}

export async function resetAllData(userId) {
  await Promise.all([
    supabase.from('brews').delete().eq('user_id', userId),
    supabase.from('beans').delete().eq('user_id', userId),
  ])
  _beans = []; _brews = []
  localStorage.removeItem('artisanal_pending_brew')
  localStorage.removeItem('artisanal_active_bean')
  localStorage.removeItem(cacheKey('beans'))
  localStorage.removeItem(cacheKey('brews'))
}

export function getStats(beans, brews) {
  if (!brews.length) return { avgRating:0, totalBrews:0, consistencyPct:0, weeklyVolumeLiters:0, weeklyYields:Array(7).fill(0), trendPct:0 }
  const sorted = [...brews].sort((a,b)=>new Date(b.date)-new Date(a.date))
  const avg = brews.reduce((s,b)=>s+b.rating,0)/brews.length
  const weekAgo = Date.now()-7*86400000, prevWeekAgo = weekAgo-7*86400000
  const weekly = brews.filter(b=>new Date(b.date)>weekAgo)
  const prevWeekly = brews.filter(b=>{const t=new Date(b.date).getTime();return t>prevWeekAgo&&t<=weekAgo})
  const vol = weekly.reduce((s,b)=>s+b.water,0)/1000
  const last7 = sorted.slice(0,7)
  const consistencyPct = last7.length?Math.round((last7.filter(b=>b.rating>=3).length/last7.length)*100):0
  const yields=[]
  for(let i=6;i>=0;i--){const ago=new Date(Date.now()-i*86400000).toDateString();const day=brews.filter(b=>new Date(b.date).toDateString()===ago);yields.push(day.length?Math.min(100,day.reduce((s,b)=>s+b.rating,0)/day.length*20):0)}
  const trendPct=prevWeekly.length?Math.round(((weekly.length-prevWeekly.length)/prevWeekly.length)*100):0
  return { avgRating:Number(avg.toFixed(1)), totalBrews:brews.length, consistencyPct, weeklyVolumeLiters:Number(vol.toFixed(1)), weeklyYields:yields, trendPct }
}

// Utilities
export function formatDate(iso) {
  const d=new Date(iso),now=new Date(),hrs=(now-d)/3600000
  const t=d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})
  if(hrs<24)return`Today, ${t}`;if(hrs<48)return`Yesterday, ${t}`
  return`${d.getDate()} ${d.toLocaleString('default',{month:'short'})}, ${t}`
}
export function formatRatio(dose,water){if(!dose||!water)return'—';return`1:${(water/dose).toFixed(1)}`}
export function formatTime(secs){return`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`}

export function buildChartPath(brews, days=30, svgW=480, svgH=180) {
  if(!brews.length)return{rating:'',extraction:''}
  const cutoff=Date.now()-days*86400000
  const pts=[...brews].sort((a,b)=>new Date(a.date)-new Date(b.date)).filter(b=>new Date(b.date)>cutoff)
  if(pts.length<2)return{rating:'',extraction:''}
  const ts=pts.map(b=>new Date(b.date).getTime())
  const minT=ts[0],maxT=ts[ts.length-1],rangeT=maxT-minT||1
  const mapX=(t)=>(((t-minT)/rangeT)*(svgW-40))+20
  const mapY=(v,min,max)=>svgH-10-(((v-min)/(max-min||1))*(svgH-20))
  const rPoints=pts.map(b=>[mapX(new Date(b.date).getTime()),mapY(b.rating,1,5)])
  const ePoints=pts.filter(b=>b.extraction).map(b=>[mapX(new Date(b.date).getTime()),mapY(b.extraction,15,25)])
  function smooth(ps){if(!ps.length)return'';let d=`M${ps[0][0].toFixed(1)},${ps[0][1].toFixed(1)}`;for(let i=1;i<ps.length;i++){const cp=(ps[i-1][0]+ps[i][0])/2;d+=` C${cp.toFixed(1)},${ps[i-1][1].toFixed(1)} ${cp.toFixed(1)},${ps[i][1].toFixed(1)} ${ps[i][0].toFixed(1)},${ps[i][1].toFixed(1)}`}return d}
  return{rating:smooth(rPoints),extraction:smooth(ePoints)}
}

export const PHASES = {
  'V60': [
    {name:'Bloom Phase',icon:'water_drop',targetWater:40,duration:30,instruction:'Pour 40g of water in a slow spiral motion starting from the center. Wait for the grounds to bloom and degas fully.'},
    {name:'First Pour',icon:'water_drop',targetWater:120,duration:45,instruction:'Pour steadily to 120g total in slow concentric circles. Maintain gentle, even saturation across all grounds.'},
    {name:'Second Pour',icon:'water_drop',targetWater:220,duration:45,instruction:'Continue pouring to reach 220g total. Keep the stream slow and steady, working from the center outward.'},
    {name:'Draw Down',icon:'hourglass_bottom',targetWater:0,duration:75,instruction:'Allow the brew to fully drain. Do not disturb the bed. Total brew time should be ~3:15.'},
  ],
  'Chemex': [
    {name:'Bloom Phase',icon:'water_drop',targetWater:60,duration:45,instruction:'Pre-wet the filter, then pour 60g in a spiral motion. Allow 45 seconds to bloom.'},
    {name:'First Pour',icon:'water_drop',targetWater:200,duration:60,instruction:'Pour slowly to 200g total. Do not disturb the coffee crust. The Chemex requires patience.'},
    {name:'Final Pour',icon:'water_drop',targetWater:400,duration:60,instruction:'Add remaining water to reach 400g total. Pour from high for clarity.'},
    {name:'Draw Down',icon:'hourglass_bottom',targetWater:0,duration:120,instruction:'Allow the full draw down. Total time ~4:30. Do not squeeze or disturb the filter.'},
  ],
  'AeroPress': [
    {name:'Fill & Steep',icon:'water_drop',targetWater:200,duration:60,instruction:'Add all 200g of water. Stir 3 times vigorously to saturate all grounds. Place cap on top to retain heat.'},
    {name:'Press',icon:'compress',targetWater:0,duration:30,instruction:'Press slowly and evenly for 20–30 seconds. Stop pressing when you hear the hiss. Total time ~1:30.'},
  ],
  'French Press': [
    {name:'Bloom',icon:'water_drop',targetWater:60,duration:30,instruction:'Add 60g of water to fully saturate the grounds. Wait 30 seconds for the bloom.'},
    {name:'Fill',icon:'water_drop',targetWater:500,duration:30,instruction:'Fill to 500g total. Place the lid on top (plunger up) without pressing down.'},
    {name:'Steep',icon:'hourglass_bottom',targetWater:0,duration:240,instruction:'Wait 4 full minutes. Resist the urge to stir — it causes over-extraction.'},
    {name:'Press & Pour',icon:'compress',targetWater:0,duration:30,instruction:'Press the plunger down slowly and evenly, then pour immediately to stop extraction.'},
  ],
}

export const TIPS = [
  'Try lowering your bloom temperature by 2°C — it can unlock more floral aromatics in light-roast washed coffees.',
  'Consistency in pour rate matters more than speed. A gooseneck kettle at 3–4g/s produces the most even extraction.',
  'Freshness peak for most specialty beans is 7–21 days post-roast. Track your roast dates to hit that window.',
  'A coarser grind with slower pour compensates for very dense, high-altitude beans and reduces over-extraction risk.',
  'Pre-heating your V60 and cup with hot water can improve brew temperature stability by up to 3°C.',
]

export function getTip() { return TIPS[new Date().getDate() % TIPS.length] }
export function getPhases(method) { return PHASES[method] || PHASES['V60'] }

// Pending brew (localStorage)
export function getPendingBrew() { try { return JSON.parse(localStorage.getItem('artisanal_pending_brew')) } catch { return null } }
export function setPendingBrew(brew) { localStorage.setItem('artisanal_pending_brew', JSON.stringify(brew)) }
export function clearPendingBrew() { localStorage.removeItem('artisanal_pending_brew') }
export function getActiveBeanId() { return localStorage.getItem('artisanal_active_bean') }
export function setActiveBeanId(id) { localStorage.setItem('artisanal_active_bean', id) }
