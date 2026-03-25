import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'

const UNSPLASH = [
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80',
  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80',
]

function tagColor(tag) {
  const lower = tag.toLowerCase()
  if (lower.includes('sour') || lower.includes('bitter') || lower.includes('harsh'))
    return 'bg-error-container text-on-error-container'
  return 'bg-tertiary-container text-on-tertiary-container'
}

function Stars({ rating, size = 'text-xs' }) {
  return (
    <>{[1,2,3,4,5].map(i => (
      <span key={i} className={`material-symbols-outlined text-primary ${size}`} style={{fontVariationSettings:`'FILL' ${i<=rating?1:0},'wght' 400,'GRAD' 0,'opsz' 24`}}>star</span>
    ))}</>
  )
}

function buildChart(brews) {
  if (brews.length < 2) return { rPath: '', ePath: '', dots: [], xLabels: [] }
  const sorted = [...brews].sort((a,b) => new Date(a.date)-new Date(b.date))
  const ts = sorted.map(b => new Date(b.date).getTime())
  const minT = ts[0], maxT = ts[ts.length-1], rangeT = maxT - minT || 1
  const W = 480, H = 190
  const mapX = t => (((t-minT)/rangeT)*(W-40))+28
  const mapY = (v, lo, hi) => H - 10 - (((v-lo)/(hi-lo||1))*(H-25))

  function smooth(pts) {
    if (!pts.length) return ''
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const cp = (pts[i-1][0]+pts[i][0])/2
      d += ` C${cp.toFixed(1)},${pts[i-1][1].toFixed(1)} ${cp.toFixed(1)},${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`
    }
    return d
  }

  const rPts = sorted.map(b => [mapX(new Date(b.date).getTime()), mapY(b.rating, 1, 5)])
  const ePts = sorted.filter(b => b.extraction).map(b => [mapX(new Date(b.date).getTime()), mapY(b.extraction, 15, 25)])

  const dots = rPts.map((p,i) => ({
    cx: p[0], cy: p[1],
    title: `${sorted[i].beanName} — ${sorted[i].rating}/5${sorted[i].tasteTags?.[0]?' ('+sorted[i].tasteTags[0]+')':''}`,
  }))

  const step = Math.max(1, Math.floor(sorted.length / 4))
  const xLabels = [sorted[0], sorted[Math.min(step,sorted.length-1)], sorted[Math.min(step*2,sorted.length-1)], sorted[Math.min(step*3,sorted.length-1)], sorted[sorted.length-1]].map(b => {
    const d = new Date(b.date)
    return `${d.getDate()} ${d.toLocaleString('default',{month:'short'})}`
  })

  return { rPath: smooth(rPts), ePath: smooth(ePts), dots, xLabels }
}

export default function Analytics() {
  const { brews, stats, setPendingBrew, setActiveBeanId, formatDate, formatRatio } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filteredBrews = useMemo(() => {
    if (!search) return brews
    const q = search.toLowerCase()
    return brews.filter(b =>
      b.beanName.toLowerCase().includes(q) ||
      b.method.toLowerCase().includes(q) ||
      (b.notes||'').toLowerCase().includes(q)
    )
  }, [brews, search])

  const bestBrews = useMemo(() => {
    return [...brews].sort((a,b) => b.rating - a.rating || new Date(b.date)-new Date(a.date)).slice(0, 2)
  }, [brews])

  const chart = useMemo(() => buildChart(brews), [brews])
  const recent = filteredBrews.slice(0, 8)

  function replicateBrew(brew) {
    setPendingBrew({
      beanId: brew.beanId, beanName: brew.beanName,
      method: brew.method, dose: brew.dose, water: brew.water, temp: brew.temp,
      ratio: brew.ratio, grindSize: brew.grindSize, brewTime: brew.brewTime,
      extraction: brew.extraction,
    })
    if (brew.beanId) setActiveBeanId(brew.beanId)
    navigate('/brew-setup')
  }

  return (
    <Layout searchPlaceholder="Search analytics or history..." onSearch={setSearch}>
      <div className="max-w-[1440px] mx-auto px-10 py-10 space-y-10">
        <section className="space-y-1">
          <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Brew Intelligence</span>
          <h2 className="font-headline text-5xl font-bold text-primary leading-tight">Analytics &amp; History</h2>
        </section>

        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Left: Chart + Best Brews */}
          <div className="col-span-8 flex flex-col gap-10">
            {/* Chart */}
            <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_12px_40px_rgba(62,39,35,0.04)]">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h3 className="font-headline text-2xl font-bold text-primary">Rating vs Extraction</h3>
                  <p className="text-on-surface-variant text-sm font-medium">30-day performance correlation</p>
                </div>
                <div className="flex gap-5">
                  <span className="flex items-center gap-2 text-xs font-bold text-primary"><span className="w-3 h-3 rounded-full bg-primary"></span>Rating (1–5)</span>
                  <span className="flex items-center gap-2 text-xs font-bold text-tertiary"><span className="w-3 h-3 rounded-full bg-tertiary"></span>Extraction (%)</span>
                </div>
              </div>
              <div className="h-64 w-full relative">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0,1,2,3,4].map(i => <div key={i} className="border-b border-outline-variant/10 w-full"></div>)}
                </div>
                <div className="absolute left-0 inset-y-0 flex flex-col justify-between py-1 pointer-events-none pr-3">
                  {['5','4','3','2','1'].map(v => <span key={v} className="text-[10px] text-outline font-bold">{v}</span>)}
                </div>
                {brews.length >= 2 ? (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 520 200" preserveAspectRatio="none" style={{paddingLeft:'24px'}}>
                    <path fill="none" stroke="#271310" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d={chart.rPath}/>
                    <path fill="none" stroke="#081c17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" d={chart.ePath}/>
                    <g>
                      {chart.dots.map((d,i) => (
                        <g key={i} className="cursor-pointer">
                          <circle cx={d.cx} cy={d.cy} r="5" fill="#271310"/>
                          <circle cx={d.cx} cy={d.cy} r="9" fill="#271310" fillOpacity="0.12"/>
                          <title>{d.title}</title>
                        </g>
                      ))}
                    </g>
                  </svg>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm">Not enough data for chart</div>
                )}
              </div>
              <div className="flex justify-between mt-5 pl-6 text-[10px] font-bold text-outline uppercase tracking-widest">
                {chart.xLabels.map((l,i) => <span key={i}>{l}</span>)}
              </div>
            </div>

            {/* Best Brews */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline text-2xl font-bold text-primary">Best Brews</h3>
                <button className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                  View Gallery <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {bestBrews.map((b, i) => (
                  <div key={b.id} className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(62,39,35,0.04)] hover:shadow-xl transition-all">
                    <div className="h-48 overflow-hidden relative">
                      <img src={UNSPLASH[i%UNSPLASH.length]} alt={b.beanName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-primary">{b.rating}.0 RATING</div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-headline text-lg font-bold text-primary">{b.beanName}</h4>
                          <p className="text-xs text-on-surface-variant font-medium">{b.method} &bull; {b.ratio||formatRatio(b.dose,b.water)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-tertiary">{b.extraction?b.extraction+'%':'—'}</p>
                          <p className="text-[10px] text-outline uppercase">Ext.</p>
                        </div>
                      </div>
                      <button onClick={() => replicateBrew(b)} className="w-full py-2.5 bg-surface-container-high text-primary rounded-md font-bold text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-colors">
                        Replicate Brew
                      </button>
                    </div>
                  </div>
                ))}
                {bestBrews.length === 0 && (
                  <div className="col-span-2 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl mb-3 opacity-30 block">coffee</span>
                    <p className="font-headline text-lg text-primary mb-1">No brews yet</p>
                    <p className="text-sm">Log your first brew to see your best here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: History + Stats */}
          <aside className="col-span-4 flex flex-col gap-6 sticky top-24">
            <div className="bg-surface-container-low rounded-xl p-7">
              <h3 className="font-headline text-2xl font-bold text-primary mb-7">Recent Brew History</h3>
              <div className="flex flex-col">
                {recent.length === 0 && <p className="text-sm text-on-surface-variant text-center py-4">No brews yet.</p>}
                {recent.map((b, i) => {
                  const isLast = i === recent.length - 1
                  const goodTags = (b.tasteTags||[]).filter(t => !t.toLowerCase().includes('sour') && !t.toLowerCase().includes('bitter'))
                  const badTags = (b.tasteTags||[]).filter(t => !goodTags.includes(t))
                  return (
                    <div key={b.id} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-outline-variant/25 mt-2"></div>}
                      </div>
                      <div className={!isLast ? 'pb-6' : ''}>
                        <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-1">{formatDate(b.date)}</p>
                        <h5 className="text-sm font-bold text-primary">{b.beanName}</h5>
                        <p className="text-xs text-on-surface-variant mt-0.5">{b.method} &bull; {b.dose}g / {b.water}g</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-surface-container-highest rounded text-[10px] font-bold text-on-surface-variant">RATING: {b.rating}/5</span>
                          {goodTags.slice(0,1).map(t => <span key={t} className="px-2 py-0.5 bg-tertiary-container text-on-tertiary-container rounded text-[10px] font-bold uppercase">{t}</span>)}
                          {badTags.slice(0,1).map(t => <span key={t} className="px-2 py-0.5 bg-error-container text-on-error-container rounded text-[10px] font-bold uppercase">{t}</span>)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="brew-gradient text-white p-6 rounded-xl flex flex-col gap-1">
                <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Avg Rating</span>
                <span className="font-headline text-3xl font-bold">{stats.avgRating.toFixed(1)}</span>
                <span className="text-[10px] opacity-60">out of 5.0</span>
              </div>
              <div className="bg-tertiary text-on-tertiary p-6 rounded-xl flex flex-col gap-1">
                <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Total Brews</span>
                <span className="font-headline text-3xl font-bold">{stats.totalBrews}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
