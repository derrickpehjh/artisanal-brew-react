import { useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import Stars from '../components/ui/Stars'

export default function Dashboard() {
  const { beans, brews, stats, getActiveBean, setActiveBeanId, formatDate, formatRatio, getTip } = useApp()
  const effRingRef = useRef<SVGCircleElement>(null)

  // Build the last-7-days activity grid with real day names and dates
  const weekActivity = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000)
      const dayStr = d.toDateString()
      const dayBrews = brews.filter(b => new Date(b.date).toDateString() === dayStr)
      return {
        dayLabel: d.toLocaleString('default', { weekday: 'short' }).slice(0, 2),
        dateNum: d.getDate(),
        isToday: i === 6,
        count: dayBrews.length,
        avgRating: dayBrews.length ? dayBrews.reduce((s, b) => s + b.rating, 0) / dayBrews.length : 0,
      }
    })
  }, [brews])

  const bean = getActiveBean()
  const last = brews[0] || null
  const otherBeans = beans.filter(b => b.id !== bean?.id)

  const stockPct = bean?.totalGrams ? Math.round((bean.remainingGrams / bean.totalGrams) * 100) : 0

  useEffect(() => {
    const timer = setTimeout(() => {
      if (effRingRef.current) {
        const offset = 364.4 * (1 - stats.consistencyPct / 100)
        effRingRef.current.style.strokeDashoffset = String(offset)
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [stats.consistencyPct])

  return (
    <Layout>
      <div className="max-w-[1440px] mx-auto px-4 py-6 md:px-10 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">

          {/* Left: Cellar */}
          <div className="col-span-1 md:col-span-3 flex flex-col gap-5">
            <div className="flex items-end justify-between">
              <h2 className="font-headline text-2xl text-primary">The Cellar</h2>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">{beans.length} Beans Total</span>
            </div>
            {bean?.id && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 bg-surface-container rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>eco</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline text-base leading-tight text-primary truncate">{bean.name}</h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{bean.process}</p>
                  </div>
                  <span className="shrink-0 text-[9px] font-bold px-2 py-0.5 bg-tertiary-fixed text-tertiary rounded-full uppercase tracking-wide">Active</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: stockPct + '%' }}></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-on-surface-variant mb-4">
                  <span>{bean.remainingGrams}g REMAINING</span>
                  <span>TOTAL {bean.totalGrams}g</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-outline-variant/10">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant/60 mb-0.5">Roast Level</p>
                    <p className="text-xs font-bold text-primary">{bean.roastLevel}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant/60 mb-0.5">Roast Date</p>
                    <p className="text-xs font-bold text-primary">{bean.roastDate}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {otherBeans.map(b => (
                <div key={b.id} onClick={() => { setActiveBeanId(b.id); window.location.reload() }} className="bg-surface-container-low rounded-xl p-4 flex items-center gap-3 hover:bg-surface-container-high transition-colors cursor-pointer group">
                  <div className="w-9 h-9 bg-surface-container-highest rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">grain</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-primary truncate">{b.name}</h4>
                    <p className="text-[11px] text-on-surface-variant">{b.process} &bull; {b.remainingGrams}g</p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-[16px] opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                </div>
              ))}
            </div>
            <Link to="/beans" className="w-full py-3 border border-dashed border-outline-variant/40 rounded-xl text-[11px] font-bold text-on-surface-variant uppercase tracking-widest hover:border-outline-variant hover:text-primary transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[16px]">add</span>Add New Bean
            </Link>
          </div>

          {/* Center: Hero + Last Brew */}
          <div className="col-span-1 md:col-span-6 flex flex-col gap-8">
            <div className="relative rounded-2xl overflow-hidden h-72 group shadow-2xl">
              <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&q=80" alt="Pour over coffee brewing" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent"></div>
              <div className="absolute inset-0 flex flex-col justify-end p-10">
                <h2 className="font-headline text-4xl text-white mb-2 leading-tight">Ready for the first cup?</h2>
                <p className="text-white/80 text-sm mb-6 max-w-xs">Using current inventory: {bean?.name}, {bean?.roastLevel} Roast.</p>
                <Link to="/brew-setup" className="w-fit px-8 py-4 bg-white text-primary rounded-md font-bold text-sm tracking-widest flex items-center gap-3 hover:bg-surface-bright transition-all active:scale-95 shadow-xl uppercase">
                  Start New Brew
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>play_arrow</span>
                </Link>
              </div>
            </div>

            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-headline text-2xl text-primary">Last Brew Archive</h2>
                <Link to="/analytics" className="text-xs font-bold text-primary underline underline-offset-4 hover:text-on-surface-variant transition-colors uppercase tracking-wide">View Full Log</Link>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
                {last ? (
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-7">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full border border-outline-variant/15 bg-surface-container flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-2xl">coffee</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">{formatDate(last.date)}</p>
                          <h3 className="font-headline text-xl text-primary">{last.method}</h3>
                          <p className="text-xs text-on-surface-variant">{last.beanName || bean?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex gap-0.5 justify-end mb-1"><Stars rating={last.rating} /></div>
                        <p className="text-xs font-bold text-primary">{last.rating}.0 / 5.0</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                      {([['Ratio', last.ratio || formatRatio(last.dose, last.water)], ['Dose', last.dose + 'g'], ['Time', last.brewTime], ['Temp', last.temp + '°C']] as [string, string][]).map(([l, v]) => (
                        <div key={l} className="p-4 bg-surface-container-low rounded-xl">
                          <p className="text-[9px] text-on-surface-variant uppercase font-bold mb-1.5">{l}</p>
                          <p className="text-lg font-headline text-primary">{v}</p>
                        </div>
                      ))}
                    </div>
                    {last.notes && <blockquote className="p-5 bg-surface-container rounded-xl italic text-on-surface-variant text-sm border-l-4 border-primary/20 leading-relaxed">"{last.notes}"</blockquote>}
                  </div>
                ) : (
                  <div className="p-8 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl mb-3 opacity-30 block">coffee</span>
                    <p className="font-headline text-lg text-primary mb-1">No brews yet</p>
                    <p className="text-sm">Start your first brew to see it here.</p>
                    <Link to="/brew-setup" className="inline-block mt-4 brew-gradient text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest">Log First Brew</Link>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right: Brew Insights */}
          <div className="col-span-1 md:col-span-3 flex flex-col gap-8">
            <h2 className="font-headline text-2xl text-primary">Brew Insights</h2>

            {/* Consistency ring */}
            <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_rgba(62,39,35,0.04)] flex flex-col items-center text-center">
              <div className="relative w-36 h-36 mb-5">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
                  <circle cx="72" cy="72" r="58" fill="transparent" stroke="#e4e2de" strokeWidth="8"/>
                  <circle ref={effRingRef} cx="72" cy="72" r="58" fill="transparent" stroke="#271310" strokeWidth="8" strokeLinecap="round" strokeDasharray="364.4" strokeDashoffset="364.4" className="transition-all duration-1000"/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-headline text-3xl text-primary font-bold leading-none">{stats.consistencyPct}%</span>
                </div>
              </div>
              <h3 className="font-bold text-sm text-primary mb-1">Consistency Rating</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {stats.avgExtraction != null
                  ? <>Last 7 brews with extraction in 18–22% target window</>
                  : <>Last 7 brews rated 3★ or above — log taste analysis to track extraction</>}
              </p>
            </div>

            {/* Extraction Window */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Extraction Window</h3>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-full uppercase tracking-wide">18–22% target</span>
              </div>
              {stats.avgExtraction != null ? (
                <>
                  <div className="relative h-6 mb-2">
                    {/* full track */}
                    <div className="absolute inset-y-0 left-0 right-0 bg-surface-container-highest rounded-full my-auto h-2 top-1/2 -translate-y-1/2"></div>
                    {/* target zone 18-22% mapped across a 14-26% display range */}
                    <div className="absolute h-2 top-1/2 -translate-y-1/2 bg-tertiary-fixed/40 rounded-full" style={{ left: `${(18 - 14) / 12 * 100}%`, width: `${(22 - 18) / 12 * 100}%` }}></div>
                    {/* avg extraction marker */}
                    <div className="absolute w-3 h-3 bg-primary rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 shadow" style={{ left: `${Math.min(100, Math.max(0, (stats.avgExtraction - 14) / 12 * 100))}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-on-surface-variant mb-3">
                    <span>14%</span><span>18%</span><span>22%</span><span>26%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant/60 mb-0.5">Avg Extraction</p>
                      <p className={`text-base font-headline font-bold ${stats.avgExtraction < 18 ? 'text-error' : stats.avgExtraction > 22 ? 'text-error' : 'text-tertiary'}`}>{stats.avgExtraction}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant/60 mb-0.5">In Range</p>
                      <p className="text-base font-headline font-bold text-primary">{stats.extractionInRange}%</p>
                    </div>
                  </div>
                  {stats.avgExtraction < 18 && <p className="text-[10px] text-error mt-2">Under-extracted — try a finer grind or longer steep</p>}
                  {stats.avgExtraction > 22 && <p className="text-[10px] text-error mt-2">Over-extracted — try a coarser grind or shorter time</p>}
                  <p className="text-[9px] text-on-surface-variant/50 mt-3 pt-3 border-t border-outline-variant/10">
                    Estimated from your dose & water ratio (no refractometer needed)
                  </p>
                </>
              ) : (
                <div className="py-2">
                  <div className="flex gap-3 mb-3">
                    <span className="material-symbols-outlined text-2xl shrink-0 text-primary opacity-30 mt-0.5">info</span>
                    <div>
                      <p className="text-xs font-bold text-primary mb-1">How extraction is measured</p>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Each time you log a brew, the app calculates extraction yield from the <span className="font-bold">dose and water</span> you enter — no guessing. The result is stored with that brew session.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 mb-4">
                    <span className="material-symbols-outlined text-2xl shrink-0 text-primary opacity-30 mt-0.5">route</span>
                    <div>
                      <p className="text-xs font-bold text-primary mb-1">To see your data here</p>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Start a brew → complete the guided timer → finish Taste Analysis. The chart above will populate with your real numbers.
                      </p>
                    </div>
                  </div>
                  <Link to="/brew-setup" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-container text-primary text-[11px] font-bold uppercase tracking-widest hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    Start a Brew
                  </Link>
                </div>
              )}
            </div>

            {/* Weekly Activity */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline text-xl text-primary">This Week</h3>
                {stats.trendPct !== 0 && (
                  <span className={`text-[10px] font-bold flex items-center gap-0.5 ${stats.trendPct > 0 ? 'text-tertiary' : 'text-error'}`}>
                    <span className="material-symbols-outlined text-sm">{stats.trendPct > 0 ? 'trending_up' : 'trending_down'}</span>
                    {stats.trendPct > 0 ? '+' : ''}{stats.trendPct}% vs last week
                  </span>
                )}
              </div>

              {/* 7-day grid */}
              <div className="bg-surface-container-low rounded-xl p-4">
                <div className="grid grid-cols-7 gap-1">
                  {weekActivity.map((day, i) => {
                    const ratingColor =
                      day.count === 0 ? ''
                      : day.avgRating >= 4.5 ? 'text-tertiary'
                      : day.avgRating >= 3.5 ? 'text-primary'
                      : 'text-error'
                    return (
                      <div
                        key={i}
                        className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg transition-colors ${
                          day.isToday ? 'bg-primary text-white' : day.count > 0 ? 'bg-surface-container' : ''
                        }`}
                      >
                        {/* Day letter */}
                        <span className={`text-[9px] font-bold uppercase ${day.isToday ? 'text-white/70' : 'text-on-surface-variant/60'}`}>
                          {day.dayLabel}
                        </span>
                        {/* Date number */}
                        <span className={`text-xs font-bold ${day.isToday ? 'text-white' : 'text-primary'}`}>
                          {day.dateNum}
                        </span>
                        {/* Rating or empty */}
                        {day.count > 0 ? (
                          <span className={`text-[10px] font-bold leading-none ${day.isToday ? 'text-white' : ratingColor}`}>
                            {day.avgRating.toFixed(1)}★
                          </span>
                        ) : (
                          <span className={`text-[10px] leading-none ${day.isToday ? 'text-white/40' : 'text-on-surface-variant/25'}`}>—</span>
                        )}
                        {/* Brew count dot */}
                        {day.count > 1 && (
                          <span className={`text-[8px] font-bold ${day.isToday ? 'text-white/60' : 'text-on-surface-variant/50'}`}>
                            ×{day.count}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Summary row */}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant/60">Brews</p>
                      <p className="text-sm font-bold text-primary">{weekActivity.reduce((s, d) => s + d.count, 0)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant/60">Avg Rating</p>
                      <p className="text-sm font-bold text-primary">
                        {(() => {
                          const days = weekActivity.filter(d => d.count > 0)
                          return days.length ? (days.reduce((s, d) => s + d.avgRating, 0) / days.length).toFixed(1) + '★' : '—'
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant/60">Volume</p>
                      <p className="text-sm font-bold text-primary">{stats.weeklyVolumeLiters}L</p>
                    </div>
                  </div>
                  <Link to="/analytics" className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wide hover:text-primary transition-colors flex items-center gap-0.5">
                    Full log <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-tertiary-container p-6 rounded-2xl relative overflow-hidden group">
              <span className="material-symbols-outlined absolute -right-3 -bottom-3 text-7xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500 pointer-events-none text-on-tertiary-container">lightbulb</span>
              <h4 className="font-headline text-lg mb-2 relative z-10 text-tertiary-fixed">Artisan Tip</h4>
              <p className="text-[11px] leading-relaxed opacity-80 relative z-10 text-on-tertiary-container">{getTip()}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
