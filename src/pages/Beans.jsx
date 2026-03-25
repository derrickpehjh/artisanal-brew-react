import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import { analyzeBeanImage } from '../lib/analyzeBean'
import { assessFreshness, getStalenessAdvice } from '../lib/aiBrewAssist'

function Stars({ rating, size = 'text-xs' }) {
  return (
    <>{[1,2,3,4,5].map(i => (
      <span key={i} className={`material-symbols-outlined text-primary ${size}`} style={{fontVariationSettings:`'FILL' ${i<=rating?1:0},'wght' 400,'GRAD' 0,'opsz' 24`}}>star</span>
    ))}</>
  )
}

function roastColor(level) {
  const map = {
    'Light': 'bg-amber-100 text-amber-800',
    'Light-Medium': 'bg-amber-200 text-amber-900',
    'Medium': 'bg-orange-200 text-orange-900',
    'Medium-Dark': 'bg-orange-300 text-orange-950',
    'Dark': 'bg-stone-300 text-stone-900',
  }
  return map[level] || 'bg-surface-container-highest text-on-surface-variant'
}

function stockLabel(remaining, total) {
  const pct = total ? Math.round((remaining / total) * 100) : 0
  if (pct <= 0) return { label: 'Empty', cls: 'text-error' }
  if (pct <= 20) return { label: 'Low Stock', cls: 'text-error' }
  if (pct <= 50) return { label: 'Running Low', cls: 'text-amber-700' }
  return { label: 'Well Stocked', cls: 'text-tertiary' }
}

function normName(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function toIsoDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIsoDate(value) {
  const iso = normalizeDateInput(value)
  if (!iso) return null
  const parsed = new Date(`${iso}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeDateInput(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  // YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[\/\.]\d{2}[\/\.]\d{2}$/.test(raw)) return raw.replace(/[\/\.]/g, '-')

  // Compact YYYYMMDD
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY (any 1-2 digit day/month + 4-digit year)
  const dmy = raw.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Fallback: native Date parsing (handles "Oct 12 2024", "October 12, 2024", etc.)
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return toIsoDateString(parsed)

  return ''
}

function parseGramValue(value) {
  if (value == null) return NaN
  const asString = String(value).trim()
  if (!asString) return NaN
  const cleaned = asString.replace(/,/g, '.')
  const direct = Number(cleaned)
  if (Number.isFinite(direct)) return direct
  const matched = cleaned.match(/\d+(?:\.\d+)?/)
  if (!matched) return NaN
  return Number(matched[0])
}

const ROAST_LEVELS = ['Light','Light-Medium','Medium','Medium-Dark','Dark']

export default function Beans() {
  const { beans, brews, addBean, updateBean, deleteBean, getActiveBean, setActiveBeanId, formatDate } = useApp()
  const navigate = useNavigate()
  const activeBean = getActiveBean()

  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [detailBeanId, setDetailBeanId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editBean, setEditBean] = useState(null)
  const [freshness, setFreshness] = useState(null)
  const [freshnessTips, setFreshnessTips] = useState(null)
  const [loadingTips, setLoadingTips] = useState(false)

  // Form state
  const [form, setForm] = useState({ name:'', origin:'', process:'', roastLevel:'Medium', roastDate:'', totalGrams:'', remainingGrams:'', notes:'' })

  useEffect(() => {
    if (!detailBeanId) { setFreshness(null); setFreshnessTips(null); return }
    const bean = beans.find(b => b.id === detailBeanId)
    if (!bean) return
    const f = assessFreshness(bean.roastDate)
    setFreshness(f)
    setFreshnessTips(null)
    if (f && f.status !== 'peak' && f.status !== 'future') {
      setLoadingTips(true)
      getStalenessAdvice(bean, f.days, f.status)
        .then(tips => setFreshnessTips(tips))
        .catch(() => setFreshnessTips(null))
        .finally(() => setLoadingTips(false))
    }
  }, [detailBeanId, beans])

  const getBeanBrews = (bean) => brews.filter(br =>
    br.beanId === bean.id ||
    ((!br.beanId || br.beanId === 'undefined') && normName(br.beanName) === normName(bean.name))
  )

  const filteredBeans = useMemo(() => {
    let result = [...beans]
    if (search) result = result.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.origin.toLowerCase().includes(search.toLowerCase()))
    if (filter === 'low') result = result.filter(b => b.remainingGrams / b.totalGrams <= 0.3)
    if (filter === 'fav') result = result.filter(b => {
      const bBrws = brews.filter(br => br.beanId === b.id || ((!br.beanId || br.beanId === 'undefined') && normName(br.beanName) === normName(b.name)))
      return bBrws.length > 0 && (bBrws.reduce((s,bw) => s + bw.rating, 0) / bBrws.length) >= 4
    })
    return result.sort((a,b) => (b.id === activeBean?.id ? 1 : 0) - (a.id === activeBean?.id ? 1 : 0))
  }, [beans, brews, search, filter, activeBean])

  const totalStock = beans.reduce((s, b) => s + b.remainingGrams, 0)
  const lowCount = beans.filter(b => b.remainingGrams / b.totalGrams <= 0.2).length
  const avgRating = brews.length ? (brews.reduce((s,b) => s + b.rating, 0) / brews.length).toFixed(1) : '—'

  const detailBean = detailBeanId ? beans.find(b => b.id === detailBeanId) : null
  const detailBrews = detailBean ? getBeanBrews(detailBean) : []
  const detailPct = detailBean?.totalGrams ? Math.round((detailBean.remainingGrams / detailBean.totalGrams) * 100) : 0
  const isDetailActive = detailBean?.id === activeBean?.id

  function openAdd() {
    setEditBean(null)
    setForm({ name:'', origin:'', process:'', roastLevel:'Medium', roastDate:'', totalGrams:'', remainingGrams:'', notes:'' })
    setScanImages([])
    setScanError(null)
    setAiFilledFields(new Set())
    setShowForm(true)
  }

  function openEdit() {
    if (!detailBean) return
    setEditBean(detailBean)
    setForm({
      name: detailBean.name, origin: detailBean.origin, process: detailBean.process || '',
      roastLevel: detailBean.roastLevel || 'Medium', roastDate: normalizeDateInput(detailBean.roastDate),
      totalGrams: String(detailBean.totalGrams), remainingGrams: String(detailBean.remainingGrams),
      notes: detailBean.notes || '',
    })
    setDetailBeanId(null)
    setShowForm(true)
  }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [scanImages, setScanImages] = useState([]) // [{file, preview}]
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [aiFilledFields, setAiFilledFields] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef(null)

  function handleImageSelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newEntries = files.map(file => ({ file, preview: URL.createObjectURL(file) }))
    setScanImages(prev => [...prev, ...newEntries])
    setScanError(null)
    setAiFilledFields(new Set())
    e.target.value = ''
  }

  function removeImage(idx) {
    setScanImages(prev => prev.filter((_, i) => i !== idx))
    setScanError(null)
    setAiFilledFields(new Set())
  }

  async function handleAIScan() {
    if (!scanImages.length) return
    setScanning(true)
    setScanError(null)
    setAiFilledFields(new Set())
    try {
      const result = await analyzeBeanImage(scanImages.map(s => s.file))
      const filled = new Set()
      const next = { ...form }
      if (result.name)       { next.name = result.name;                        filled.add('name') }
      if (result.origin)     { next.origin = result.origin;                    filled.add('origin') }
      if (result.process)    { next.process = result.process;                  filled.add('process') }
      if (result.roastLevel) { next.roastLevel = result.roastLevel;            filled.add('roastLevel') }
      if (result.roastDate)  { next.roastDate = normalizeDateInput(result.roastDate); filled.add('roastDate') }
      if (result.totalGrams) {
        const grams = parseGramValue(result.totalGrams)
        if (Number.isFinite(grams)) {
          next.totalGrams = String(grams)
          filled.add('totalGrams')
        }
      }
      if (result.notes)      { next.notes = result.notes;                      filled.add('notes') }
      setForm(next)
      setAiFilledFields(filled)
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanning(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    const name = form.name.trim()
    const origin = form.origin.trim()
    if (!name) {
      setSaveError('Bean name is required.')
      setSaving(false)
      return
    }
    if (!origin) {
      setSaveError('Origin is required.')
      setSaving(false)
      return
    }

    const totalGrams = parseGramValue(form.totalGrams)
    const remainingGrams = form.remainingGrams ? parseGramValue(form.remainingGrams) : totalGrams
    if (!Number.isFinite(totalGrams) || totalGrams <= 0) {
      setSaveError('Total grams must be a valid number greater than 0.')
      setSaving(false)
      return
    }
    if (!Number.isFinite(remainingGrams) || remainingGrams < 0) {
      setSaveError('Remaining grams must be a valid number.')
      setSaving(false)
      return
    }
    if (remainingGrams > totalGrams) {
      setSaveError('Remaining grams cannot exceed total grams.')
      setSaving(false)
      return
    }

    const bean = {
      name, origin, process: form.process.trim(),
      roastLevel: form.roastLevel, roastDate: normalizeDateInput(form.roastDate) || null,
      totalGrams,
      remainingGrams,
      notes: form.notes.trim(),
    }
    try {
      if (editBean) await updateBean(editBean.id, bean)
      else await addBean(bean)
      setShowForm(false)
    } catch (err) {
      setSaveError(err.message || 'Failed to save bean. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function brewThisBean() {
    if (detailBean) {
      setActiveBeanId(detailBean.id)
      navigate('/brew-setup')
    }
  }

  async function handleDeleteBean() {
    if (!detailBean || deleting) return
    const beanName = detailBean.name
    const deletingActiveBean = detailBean.id === activeBean?.id
    const nextBean = beans.find(b => b.id !== detailBean.id)

    if (!confirm(`Delete bean "${beanName}"? This cannot be undone.`)) return

    setDeleting(true)
    try {
      await deleteBean(detailBean.id)
      if (deletingActiveBean) {
        if (nextBean?.id) setActiveBeanId(nextBean.id)
        else localStorage.removeItem('artisanal_active_bean')
      }
      setDetailBeanId(null)
    } catch (err) {
      alert(err?.message || 'Failed to delete bean. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Layout searchPlaceholder="Search beans..." onSearch={setSearch}>
      <div className="max-w-[1440px] mx-auto px-4 py-6 md:px-10 md:py-10">
        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6 md:mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Bean Cellar</p>
            <h2 className="font-headline text-3xl text-primary">Your Collection</h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex gap-1 bg-surface-container-high rounded-full p-1">
              {[['all','All'],['low','Low Stock'],['fav','Rated']].map(([f,label]) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter===f ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}>{label}</button>
              ))}
            </div>
            <button onClick={openAdd} className="brew-gradient flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[16px]">add</span> Add Bean
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          {[
            { label:'Beans in Cellar', value:beans.length, icon:'grain', sub:`${activeBean?.name || ''} active`, warn:false },
            { label:'Total Stock', value:`${totalStock}g`, icon:'scale', sub:`across ${beans.length} bean${beans.length!==1?'s':''}`, warn:false },
            { label:'Low Stock Alerts', value:lowCount, icon:'warning', sub:lowCount?'need restocking soon':'all stocked up', warn:lowCount>0 },
            { label:'Avg Brew Rating', value:avgRating, icon:'star', sub:'across all your brews', warn:false },
          ].map(it => (
            <div key={it.label} className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_2px_12px_rgba(62,39,35,0.04)]">
              <div className="flex items-center gap-3 mb-2">
                <span className={`material-symbols-outlined text-[18px] ${it.warn?'text-error':'text-on-surface-variant'}`}>{it.icon}</span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{it.label}</span>
              </div>
              <p className="font-headline text-2xl text-primary">{it.value}</p>
              <p className={`text-[11px] mt-0.5 ${it.warn?'text-error font-semibold':'text-on-surface-variant'}`}>{it.sub}</p>
            </div>
          ))}
        </div>

        {/* Bean grid */}
        {filteredBeans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">grain</span>
            </div>
            <p className="font-headline text-xl text-primary mb-1">No beans found</p>
            <p className="text-sm text-on-surface-variant mb-6">Try adjusting your filter or add a new bean to your cellar.</p>
            <button onClick={openAdd} className="brew-gradient px-6 py-3 rounded-full text-white text-sm font-bold">Add Your First Bean</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {filteredBeans.map(bean => {
              const isActive = bean.id === activeBean?.id
              const pct = bean.totalGrams ? Math.round((bean.remainingGrams / bean.totalGrams) * 100) : 0
              const sl = stockLabel(bean.remainingGrams, bean.totalGrams)
              const beanBrews = getBeanBrews(bean)
              const avgR = beanBrews.length ? (beanBrews.reduce((s,b)=>s+b.rating,0)/beanBrews.length).toFixed(1) : null
              return (
                <div
                  key={bean.id}
                  onClick={() => setDetailBeanId(bean.id)}
                  className={`bg-surface-container-lowest rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-all duration-200 hover:shadow-[0_8px_32px_rgba(62,39,35,0.10)] ${isActive?'shadow-[0_0_0_2px_#271310,0_4px_24px_rgba(62,39,35,0.12)]':'shadow-[0_4px_20px_rgba(62,39,35,0.04)]'}`}
                >
                  <div className="brew-gradient px-6 pt-6 pb-5 relative">
                    {isActive && (
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-on-primary/10 rounded-full px-3 py-1">
                        <span className="w-1.5 h-1.5 bg-on-primary rounded-full"></span>
                        <span className="text-[9px] font-bold text-white/80 uppercase tracking-wide">Active</span>
                      </div>
                    )}
                    <p className="text-[9px] uppercase tracking-widest text-white/50 font-bold mb-1">{bean.origin}</p>
                    <h3 className="font-headline text-lg text-white leading-snug">{bean.name}</h3>
                    <p className="text-xs text-white/60 mt-0.5">{bean.process || '—'}</p>
                    <div className="mt-4">
                      <div className="flex justify-between text-[9px] text-white/50 font-bold uppercase tracking-wide mb-1">
                        <span>{sl.label}</span>
                        <span>{bean.remainingGrams}g / {bean.totalGrams}g</span>
                      </div>
                      <div className="h-1 bg-on-primary/20 rounded-full overflow-hidden">
                        <div className="h-full bg-on-primary/70 rounded-full transition-all duration-500" style={{width: pct+'%'}}></div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${roastColor(bean.roastLevel)}`}>{bean.roastLevel || 'Unknown'}</span>
                      {bean.roastDate && <span className="px-2.5 py-1 bg-surface-container rounded-full text-[10px] font-bold text-on-surface-variant">Roasted {bean.roastDate}</span>}
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed italic line-clamp-2 mb-4">{bean.notes || 'No tasting notes added yet.'}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-surface-container-highest">
                      <div className="flex items-center gap-1">
                        <Stars rating={Math.round(parseFloat(avgR)||0)} />
                        <span className="text-[10px] font-bold text-on-surface-variant ml-1">{avgR || '—'}</span>
                      </div>
                      <div className="text-right">
                        {avgR
                          ? <p className="text-xs font-bold text-primary">{avgR} <span className="text-on-surface-variant font-medium">your avg</span></p>
                          : <p className="text-xs text-on-surface-variant">No brews yet</p>
                        }
                        <p className="text-[10px] text-on-surface-variant">{beanBrews.length} brew{beanBrews.length!==1?'s':''} logged</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailBean && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setDetailBeanId(null)}>
          <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm"></div>
          <div className="relative bg-surface-container-lowest rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="brew-gradient px-8 pt-8 pb-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/60 font-bold mb-1">{detailBean.origin}</p>
                  <h3 className="font-headline text-2xl text-white leading-tight">{detailBean.name}</h3>
                  <p className="text-sm text-white/70 mt-1">{detailBean.process}</p>
                </div>
                <button onClick={() => setDetailBeanId(null)} className="text-white/50 hover:text-white transition-colors mt-1">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-[10px] text-white/60 font-bold uppercase tracking-wide mb-1.5">
                  <span>Stock Remaining</span>
                  <span>{detailBean.remainingGrams}g of {detailBean.totalGrams}g</span>
                </div>
                <div className="h-1.5 bg-on-primary/20 rounded-full overflow-hidden">
                  <div className="h-full bg-on-primary/80 rounded-full transition-all duration-500" style={{width: detailPct+'%'}}></div>
                </div>
              </div>
            </div>
            <div className="px-8 py-6 grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Bean Profile</p>
                  <div className="space-y-2.5">
                    {[['Roast Level',detailBean.roastLevel||'—'],['Roast Date',detailBean.roastDate||'—'],['Total Purchased',detailBean.totalGrams+'g'],['Remaining',detailBean.remainingGrams+'g']].map(([l,v]) => (
                      <div key={l} className="flex justify-between text-sm"><span className="text-on-surface-variant">{l}</span><span className="font-semibold text-on-surface">{v}</span></div>
                    ))}
                    {freshness && (
                      <div className="mt-3 pt-3 border-t border-outline-variant/10">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-on-surface-variant">Freshness</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${freshness.bg} ${freshness.color}`}>{freshness.label}</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant">{freshness.days} days since roast</p>
                        {freshness.status !== 'peak' && (
                          <div className="mt-2">
                            {loadingTips ? (
                              <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                                <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                                Getting AI tips…
                              </div>
                            ) : freshnessTips ? (
                              <div className="mt-1 p-2.5 bg-surface-container rounded-lg">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>auto_awesome</span>
                                  AI Compensation Tips
                                </p>
                                <p className="text-[10px] text-on-surface leading-relaxed whitespace-pre-line">{freshnessTips}</p>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Your Brews</p>
                  {detailBrews.length ? (
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Total Brews</span><span className="font-semibold text-on-surface">{detailBrews.length}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Avg Rating</span><span className="font-semibold text-on-surface">{(detailBrews.reduce((s,b)=>s+b.rating,0)/detailBrews.length).toFixed(1)} / 5</span></div>
                      <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Consumed</span><span className="font-semibold text-on-surface">{detailBean.totalGrams-detailBean.remainingGrams}g</span></div>
                    </div>
                  ) : <p className="text-sm text-on-surface-variant italic">No brews logged yet.</p>}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Tasting Notes</p>
                  <p className="text-sm text-on-surface leading-relaxed italic">{detailBean.notes||'No tasting notes added yet.'}</p>
                </div>
                {detailBrews[0] && (
                  <div className="bg-surface-container rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Last Brew</p>
                    <div className="text-sm text-on-surface space-y-1">
                      <div className="flex justify-between"><span className="text-on-surface-variant">Method</span><span className="font-semibold">{detailBrews[0].method}</span></div>
                      <div className="flex justify-between"><span className="text-on-surface-variant">Rating</span><div className="flex"><Stars rating={detailBrews[0].rating} /></div></div>
                      <div className="flex justify-between"><span className="text-on-surface-variant">Date</span><span className="font-semibold">{formatDate(detailBrews[0].date)}</span></div>
                    </div>
                  </div>
                )}
                <div className="mt-auto flex flex-col gap-2.5 pt-2">
                  <button
                    onClick={() => { setActiveBeanId(detailBean.id); setDetailBeanId(null) }}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${isDetailActive ? 'bg-surface-container-highest text-on-surface-variant cursor-default' : 'bg-tertiary-fixed text-tertiary hover:bg-tertiary hover:text-on-tertiary'}`}
                    disabled={isDetailActive}
                  >
                    {isDetailActive ? 'Currently Active Bean' : 'Set as Active Bean'}
                  </button>
                  <button onClick={brewThisBean} className="w-full brew-gradient py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all">
                    Brew This Bean
                  </button>
                  <button onClick={openEdit} className="w-full bg-surface-container py-3 rounded-xl text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors">
                    Edit Details
                  </button>
                  <button
                    onClick={handleDeleteBean}
                    disabled={deleting}
                    className="w-full bg-error-container/40 py-3 rounded-xl text-error text-sm font-bold hover:bg-error-container/60 transition-colors disabled:opacity-60"
                  >
                    {deleting
                      ? <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Deleting…</span>
                      : 'Delete Bean'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm"></div>
          <div className="relative bg-surface-container-lowest rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="brew-gradient px-8 pt-7 pb-6">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-xl text-white">{editBean ? 'Edit Bean' : 'Add New Bean'}</h3>
                <button onClick={() => setShowForm(false)} className="text-white/50 hover:text-white transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            <form onSubmit={handleSave} className="px-8 py-6 space-y-5">
              {/* AI Image Scan — only show when adding */}
              {!editBean && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Scan Bean Bag with AI</label>
                  {/* Thumbnail grid + add more */}
                  <div className="flex flex-wrap gap-2">
                    {scanImages.map((s, idx) => (
                      <div key={idx} className="relative w-20 h-20 shrink-0">
                        <img src={s.preview} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-outline-variant/20" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-[12px]">close</span>
                        </button>
                      </div>
                    ))}
                    {/* Add photo tile */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-on-surface-variant hover:border-primary/40 hover:text-primary hover:bg-surface-container-low transition-all ${scanImages.length === 0 ? 'w-full h-auto py-6 border-outline-variant/50' : 'border-outline-variant/40'}`}
                    >
                      <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                      {scanImages.length === 0 && (
                        <>
                          <span className="text-xs font-bold uppercase tracking-wide">Upload photos of the bean bag</span>
                          <span className="text-[10px]">Any language · Multiple angles · Powered by Gemini</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Scan button + feedback */}
                  {scanImages.length > 0 && (
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        type="button"
                        onClick={handleAIScan}
                        disabled={scanning}
                        className="brew-gradient text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
                      >
                        {scanning ? (
                          <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Analysing…</>
                        ) : (
                          <><span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>auto_awesome</span>Auto-fill with AI</>
                        )}
                      </button>
                      <span className="text-[10px] text-on-surface-variant">{scanImages.length} photo{scanImages.length !== 1 ? 's' : ''} selected</span>
                      {aiFilledFields.size > 0 && (
                        <p className="text-[10px] text-tertiary font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>check_circle</span>
                          {aiFilledFields.size} field{aiFilledFields.size !== 1 ? 's' : ''} filled — review below
                        </p>
                      )}
                      {scanError && <p className="text-[10px] text-error font-medium">{scanError}</p>}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
                  {aiFilledFields.size > 0 && <div className="mt-3 h-px bg-outline-variant/20" />}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                    Bean Name *{aiFilledFields.has('name') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
                  </label>
                  <input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Ethiopia Yirgacheffe" className={`w-full rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 outline-none transition-colors ${aiFilledFields.has('name') ? 'bg-tertiary-fixed/40 focus:ring-tertiary/30' : 'bg-surface-container focus:ring-primary/30'}`} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                    Origin *{aiFilledFields.has('origin') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
                  </label>
                  <input required value={form.origin} onChange={e=>setForm(f=>({...f,origin:e.target.value}))} placeholder="e.g. Ethiopia" className={`w-full rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 outline-none transition-colors ${aiFilledFields.has('origin') ? 'bg-tertiary-fixed/40 focus:ring-tertiary/30' : 'bg-surface-container focus:ring-primary/30'}`} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                    Process{aiFilledFields.has('process') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
                  </label>
                  <input value={form.process} onChange={e=>setForm(f=>({...f,process:e.target.value}))} placeholder="e.g. Washed Process" className={`w-full rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 outline-none transition-colors ${aiFilledFields.has('process') ? 'bg-tertiary-fixed/40 focus:ring-tertiary/30' : 'bg-surface-container focus:ring-primary/30'}`} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                    Roast Level{aiFilledFields.has('roastLevel') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
                  </label>
                  <select value={form.roastLevel} onChange={e=>setForm(f=>({...f,roastLevel:e.target.value}))} className={`w-full rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 outline-none transition-colors ${aiFilledFields.has('roastLevel') ? 'bg-tertiary-fixed/40 focus:ring-tertiary/30' : 'bg-surface-container focus:ring-primary/30'}`}>
                    {ROAST_LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                    Roast Date{aiFilledFields.has('roastDate') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
                  </label>
                  <DatePicker
                    selected={parseIsoDate(form.roastDate)}
                    onChange={(date) => setForm(f => ({ ...f, roastDate: date ? toIsoDateString(date) : '' }))}
                    dateFormat="MMM d, yyyy"
                    placeholderText="Select roast date"
                    maxDate={new Date()}
                    isClearable
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    wrapperClassName="w-full"
                    className={`w-full rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 outline-none transition-colors ${aiFilledFields.has('roastDate') ? 'bg-tertiary-fixed/40 focus:ring-tertiary/30' : 'bg-surface-container focus:ring-primary/30'}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                    Total Grams *{aiFilledFields.has('totalGrams') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
                  </label>
                  <input type="number" required min="1" value={form.totalGrams} onChange={e=>setForm(f=>({...f,totalGrams:e.target.value}))} placeholder="250" className={`w-full rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 outline-none transition-colors ${aiFilledFields.has('totalGrams') ? 'bg-tertiary-fixed/40 focus:ring-tertiary/30' : 'bg-surface-container focus:ring-primary/30'}`} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">Remaining Grams</label>
                  <input type="number" min="0" value={form.remainingGrams} onChange={e=>setForm(f=>({...f,remainingGrams:e.target.value}))} placeholder="Same as total" className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                    Tasting Notes{aiFilledFields.has('notes') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
                  </label>
                  <textarea rows="2" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Describe the flavour profile..." className={`w-full rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 outline-none resize-none transition-colors ${aiFilledFields.has('notes') ? 'bg-tertiary-fixed/40 focus:ring-tertiary/30' : 'bg-surface-container focus:ring-primary/30'}`} />
                </div>
              </div>
              {saveError && <p className="text-xs text-error font-medium">{saveError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 bg-surface-container rounded-xl text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 brew-gradient py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60">
                  {saving
                    ? <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Saving…</span>
                    : 'Save Bean'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
