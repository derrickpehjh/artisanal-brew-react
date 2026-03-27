import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import Stars from '../components/ui/Stars'
import type { Brew } from '../types/brew'

const UNSPLASH = [
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80',
  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80',
]

// Color badge per brew method — uses only existing theme tokens
const METHOD_BADGE: Record<string, string> = {
  'V60': 'bg-primary text-white',
  'Chemex': 'bg-tertiary-container text-on-tertiary-container',
  'AeroPress': 'bg-surface-container-highest text-on-surface',
  'French Press': 'bg-surface-container text-on-surface-variant',
}

interface ChartData {
  rPath: string
  ePath: string
  dots: { cx: number; cy: number; rating: number; title: string }[]
  xLabels: string[]
}

function buildChart(brews: Brew[]): ChartData {
  if (brews.length < 2) return { rPath: '', ePath: '', dots: [], xLabels: [] }
  const sorted = [...brews].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const ts = sorted.map(b => new Date(b.date).getTime())
  const minT = ts[0], maxT = ts[ts.length - 1], rangeT = maxT - minT || 1
  const W = 480, H = 190
  const mapX = (t: number) => (((t - minT) / rangeT) * (W - 40)) + 20
  const mapY = (v: number, lo: number, hi: number) => H - 10 - (((v - lo) / (hi - lo || 1)) * (H - 25))

  function smooth(pts: [number, number][]): string {
    if (!pts.length) return ''
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const cp = (pts[i - 1][0] + pts[i][0]) / 2
      d += ` C${cp.toFixed(1)},${pts[i - 1][1].toFixed(1)} ${cp.toFixed(1)},${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`
    }
    return d
  }

  const rPts: [number, number][] = sorted.map(b => [mapX(new Date(b.date).getTime()), mapY(b.rating, 1, 5)])
  const ePts: [number, number][] = sorted
    .filter(b => b.extraction != null && b.extraction > 0)
    .map(b => [mapX(new Date(b.date).getTime()), mapY(b.extraction!, 14, 26)])

  const dots = rPts.map((p, i) => ({
    cx: p[0], cy: p[1], rating: sorted[i].rating,
    title: `${sorted[i].beanName} — ${sorted[i].rating}/5${sorted[i].tasteTags?.[0] ? ' (' + sorted[i].tasteTags[0] + ')' : ''}`,
  }))

  const step = Math.max(1, Math.floor(sorted.length / 4))
  const xLabels = [
    sorted[0],
    sorted[Math.min(step, sorted.length - 1)],
    sorted[Math.min(step * 2, sorted.length - 1)],
    sorted[Math.min(step * 3, sorted.length - 1)],
    sorted[sorted.length - 1],
  ].map(b => {
    const d = new Date(b.date)
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`
  })

  return { rPath: smooth(rPts), ePath: smooth(ePts), dots, xLabels }
}

export default function Analytics() {
  const { brews, stats, setPendingBrew, setActiveBeanId, formatDate, formatRatio } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | 'all'>('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date' | 'rating'>('date')

  const chartBrews = useMemo(() => {
    if (timeFilter === 'all') return brews
    const days = timeFilter === '7d' ? 7 : 30
    const since = Date.now() - days * 86400000
    return brews.filter(b => new Date(b.date).getTime() > since)
  }, [brews, timeFilter])

  const filteredHistory = useMemo(() => {
    let result = [...brews]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(b =>
        b.beanName.toLowerCase().includes(q) ||
        b.method.toLowerCase().includes(q) ||
        (b.notes || '').toLowerCase().includes(q)
      )
    }
    if (methodFilter !== 'all') result = result.filter(b => b.method === methodFilter)
    return result.sort((a, b) =>
      sortBy === 'rating'
        ? b.rating - a.rating || new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [brews, search, methodFilter, sortBy])

  const bestBrews = useMemo(
    () => [...brews].sort((a, b) => b.rating - a.rating || new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3),
    [brews]
  )

  const chart = useMemo(() => buildChart(chartBrews), [chartBrews])
  const hasExtractionData = brews.some(b => b.extraction != null && b.extraction > 0)

  function replicateBrew(brew: Brew) {
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
    <Layout searchPlaceholder="Search brew history..." onSearch={setSearch}>
      <div className="max-w-[1440px] mx-auto px-4 py-6 md:px-10 md:py-10 space-y-8 md:space-y-10">

        {/* Page header */}
        <section className="space-y-1">
          <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Brew Intelligence</span>
          <h2 className="font-headline text-5xl font-bold text-primary leading-tight">Analytics &amp; History</h2>
          <p className="text-on-surface-variant font-medium pt-1">Track your extraction journey and replicate your best sessions.</p>
        </section>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {([
            { label: 'Total Brews', value: String(stats.totalBrews), icon: 'coffee', sub: 'sessions logged' },
            { label: 'Avg Rating', value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) + ' / 5' : '—', icon: 'star', sub: 'across all sessions' },
            {
              label: 'Avg Extraction',
              value: stats.avgExtraction != null ? stats.avgExtraction + '%' : '—',
              icon: 'science',
              sub: stats.avgExtraction != null
                ? (stats.avgExtraction >= 18 && stats.avgExtraction <= 22 ? 'in target zone ✓' : stats.avgExtraction < 18 ? 'under-extracted' : 'over-extracted')
                : 'complete taste analysis',
            },
            { label: 'Consistency', value: stats.consistencyPct + '%', icon: 'track_changes', sub: 'last 7 brews on target' },
          ] as { label: string; value: string; icon: string; sub: string }[]).map(s => (
            <div key={s.label} className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_2px_12px_rgba(62,39,35,0.04)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>{s.icon}</span>
                <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">{s.label}</span>
              </div>
              <p className="font-headline text-2xl text-primary leading-none mb-1">{s.value}</p>
              <p className="text-[10px] text-on-surface-variant">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">

          {/* Left: Chart + Best Brews */}
          <div className="col-span-1 md:col-span-8 flex flex-col gap-8 md:gap-10">

            {/* Chart */}
            <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-[0_12px_40px_rgba(62,39,35,0.04)]">
              <div className="flex flex-wrap gap-4 justify-between items-start mb-6">
                <div>
                  <h3 className="font-headline text-xl font-bold text-primary">Rating Over Time</h3>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    {hasExtractionData ? 'Solid = rating · Dashed = extraction %' : 'Complete taste analysis to add extraction tracking'}
                  </p>
                </div>
                {/* Time filter */}
                <div className="flex gap-1 bg-surface-container-high rounded-full p-1 shrink-0">
                  {([['7d', '7 Days'], ['30d', '30 Days'], ['all', 'All Time']] as [string, string][]).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setTimeFilter(k as '7d' | '30d' | 'all')}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${timeFilter === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart body with dual y-axis */}
              <div className="flex gap-2">
                {/* Left y-axis: rating */}
                <div className="flex flex-col justify-between py-1 pr-2 h-48 shrink-0">
                  {['5', '4', '3', '2', '1'].map(v => (
                    <span key={v} className="text-[10px] text-outline font-bold leading-none">{v}</span>
                  ))}
                </div>

                {/* Chart canvas */}
                <div className="flex-1 relative h-48">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3, 4].map(i => <div key={i} className="border-b border-outline-variant/10 w-full"></div>)}
                  </div>
                  {chartBrews.length >= 2 ? (
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 480 190" preserveAspectRatio="none">
                      <path fill="none" stroke="#271310" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d={chart.rPath}/>
                      {hasExtractionData && (
                        <path fill="none" stroke="#1b5e20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" d={chart.ePath}/>
                      )}
                      {chart.dots.map((d, i) => (
                        <g key={i} className="cursor-pointer">
                          <circle cx={d.cx} cy={d.cy} r="5" fill="#271310"/>
                          <circle cx={d.cx} cy={d.cy} r="9" fill="#271310" fillOpacity="0.12"/>
                          <title>{d.title}</title>
                        </g>
                      ))}
                    </svg>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-20">show_chart</span>
                      <p className="text-sm font-bold text-primary">Not enough data</p>
                      <p className="text-xs text-on-surface-variant">Log at least 2 brews to see your trend</p>
                    </div>
                  )}
                </div>

                {/* Right y-axis: extraction */}
                {hasExtractionData && (
                  <div className="flex flex-col justify-between py-1 pl-2 h-48 shrink-0">
                    {['26%', '23%', '20%', '17%', '14%'].map(v => (
                      <span key={v} className="text-[10px] text-outline font-bold leading-none text-right" style={{ color: '#1b5e20', opacity: 0.7 }}>{v}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* X-axis labels */}
              {chart.xLabels.length > 0 && (
                <div className="flex justify-between mt-3 text-[10px] font-bold text-outline uppercase tracking-widest pl-8">
                  {chart.xLabels.map((l, i) => <span key={i}>{l}</span>)}
                </div>
              )}

              {/* Legend */}
              <div className="flex gap-5 mt-4 pt-4 border-t border-outline-variant/10">
                <span className="flex items-center gap-2 text-xs font-bold text-primary">
                  <span className="inline-block w-5 h-0.5 bg-primary rounded-full"></span>Rating (1–5)
                </span>
                {hasExtractionData && (
                  <span className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                    <span className="inline-block w-5 h-0.5 rounded-full" style={{ background: '#1b5e20', borderTop: '2px dashed #1b5e20', height: '1px' }}></span>
                    Extraction %
                  </span>
                )}
              </div>
            </div>

            {/* Best Brews */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-headline text-2xl font-bold text-primary">Best Brews</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Your highest-rated sessions — one click to replicate</p>
                </div>
                <Link to="/recipes" className="text-xs font-bold text-primary underline underline-offset-4 hover:text-on-surface-variant transition-colors uppercase tracking-wide flex items-center gap-1">
                  All Recipes <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>

              {bestBrews.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {bestBrews.map((b, i) => (
                    <div key={b.id} className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(62,39,35,0.04)] hover:shadow-lg transition-all flex flex-col">
                      <div className="h-36 overflow-hidden relative">
                        <img src={UNSPLASH[i % UNSPLASH.length]} alt={b.beanName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent"></div>
                        <div className="absolute bottom-2 left-3 right-3 flex justify-between items-end">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${METHOD_BADGE[b.method] || 'bg-surface-container text-on-surface-variant'}`}>{b.method}</span>
                          {b.extraction != null && b.extraction > 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 bg-white/90 text-primary rounded">{b.extraction}%</span>
                          )}
                        </div>
                      </div>
                      <div className="p-4 flex flex-col flex-1 gap-3">
                        <div>
                          <h4 className="font-headline text-sm font-bold text-primary leading-tight">{b.beanName}</h4>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">{b.ratio || formatRatio(b.dose, b.water)} · {b.dose}g / {b.water}g</p>
                        </div>
                        <div className="flex gap-0.5"><Stars rating={b.rating} size="text-xs" /></div>
                        <button
                          onClick={() => replicateBrew(b)}
                          className="mt-auto w-full py-2 bg-surface-container-high text-primary rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-colors"
                        >
                          Replicate Brew
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-5xl mb-3 opacity-20 block text-primary">coffee</span>
                  <p className="font-headline text-lg text-primary mb-1">No brews logged yet</p>
                  <p className="text-sm text-on-surface-variant mb-5">Start your first session to see your best here.</p>
                  <Link to="/brew-setup" className="brew-gradient inline-block text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest">Start Brewing</Link>
                </div>
              )}
            </div>
          </div>

          {/* Right: Brew History */}
          <aside className="col-span-1 md:col-span-4 md:sticky md:top-24">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline text-xl font-bold text-primary">Brew History</h3>
                <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                  {filteredHistory.length} brew{filteredHistory.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Method filter chips */}
              <div className="flex gap-1.5 flex-wrap mb-3">
                {['all', 'V60', 'Chemex', 'AeroPress', 'French Press'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMethodFilter(m)}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all ${
                      methodFilter === m ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    {m === 'all' ? 'All' : m}
                  </button>
                ))}
              </div>

              {/* Sort toggle */}
              <div className="flex gap-1 bg-surface-container-high rounded-full p-1 mb-4 w-fit">
                {([['date', 'Recent'], ['rating', 'Top Rated']] as [string, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSortBy(k as 'date' | 'rating')}
                    className={`px-3 py-1 rounded-full text-[9px] font-bold transition-all ${sortBy === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* History entries */}
              <div className="flex flex-col gap-2.5 max-h-[62vh] overflow-y-auto pr-0.5">
                {filteredHistory.length === 0 ? (
                  <div className="py-10 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-20 block mb-2">search_off</span>
                    <p className="text-sm font-bold text-primary mb-1">No results</p>
                    <p className="text-xs text-on-surface-variant">Try a different filter or search term.</p>
                  </div>
                ) : (
                  filteredHistory.map(b => (
                    <div key={b.id} className="bg-surface-container-low rounded-xl p-4 hover:bg-surface-container-high transition-colors group cursor-default">
                      {/* Top row: method + date | stars + extraction */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${METHOD_BADGE[b.method] || 'bg-surface-container text-on-surface-variant'}`}>
                            {b.method}
                          </span>
                          <span className="text-[10px] text-on-surface-variant/70 font-medium">{formatDate(b.date)}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="flex gap-0.5 justify-end mb-0.5">
                            <Stars rating={b.rating} size="text-[10px]" />
                          </div>
                          {b.extraction != null && b.extraction > 0 && (
                            <span className={`text-[9px] font-bold ${b.extraction >= 18 && b.extraction <= 22 ? 'text-tertiary' : 'text-error'}`}>
                              {b.extraction}% ext.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bean name */}
                      <p className="text-sm font-bold text-primary truncate mb-1">{b.beanName}</p>

                      {/* Brew params */}
                      <p className="text-[10px] text-on-surface-variant mb-2">
                        {b.dose}g / {b.water}g &bull; {b.temp}°C &bull; {b.brewTime}
                      </p>

                      {/* Tags + replicate */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1 flex-wrap min-w-0">
                          {(b.tasteTags || []).slice(0, 2).map(t => (
                            <span key={t} className="text-[8px] font-bold px-1.5 py-0.5 bg-surface-container rounded text-on-surface-variant uppercase">{t}</span>
                          ))}
                        </div>
                        <button
                          onClick={() => replicateBrew(b)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-primary uppercase tracking-wide flex items-center gap-0.5 shrink-0"
                        >
                          Replicate <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
