import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ui/ConfirmModal'
import BeanCard from '../components/beans/BeanCard'
import BeanDetailModal from '../components/beans/BeanDetailModal'
import BeanFormModal, { toIsoDateString } from '../components/beans/BeanFormModal'
import { analyzeBeanImage } from '../lib/analyzeBean'
import { assessFreshness, getStalenessAdvice } from '../lib/aiBrewAssist'
import type { Bean, BeanFormState } from '../types/bean'
import type { FreshnessResult } from '../types/ai'

function normalizeDateInput(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{4}[/.]?\d{2}[/.]?\d{2}$/.test(raw)) return raw.replace(/[/.]/g, '-')
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  const dmy = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return toIsoDateString(parsed)
  return ''
}

function parseGramValue(value: string | number | null | undefined): number {
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

interface ScanImage {
  file: File
  preview: string
}

const EMPTY_FORM: BeanFormState = { name: '', origin: '', process: '', roastLevel: 'Medium', roastDate: '', totalGrams: '', remainingGrams: '', notes: '' }

export default function Beans() {
  const { beans, brews, addBean, updateBean, deleteBean, getActiveBean, setActiveBeanId, formatDate } = useApp()
  const navigate = useNavigate()
  const activeBean = getActiveBean()

  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [detailBeanId, setDetailBeanId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editBean, setEditBean] = useState<Bean | null>(null)
  const [freshness, setFreshness] = useState<FreshnessResult | null>(null)
  const [freshnessTips, setFreshnessTips] = useState<string | null>(null)
  const [loadingTips, setLoadingTips] = useState(false)
  const [tipsError, setTipsError] = useState<string | null>(null)

  const [form, setForm] = useState<BeanFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [scanImages, setScanImages] = useState<ScanImage[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const confirmingDeleteRef = useRef(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function fetchFreshnessTips(bean: Bean, f: FreshnessResult) {
    setLoadingTips(true)
    setTipsError(null)
    setFreshnessTips(null)
    getStalenessAdvice(bean, f.days, f.status)
      .then(tips => { if (tips) setFreshnessTips(tips); else setTipsError('No response from AI.') })
      .catch(e => setTipsError((e as Error)?.message || 'Unknown error'))
      .finally(() => setLoadingTips(false))
  }

  useEffect(() => {
    if (!detailBeanId) { setFreshness(null); setFreshnessTips(null); setTipsError(null); return }
    const bean = beans.find(b => b.id === detailBeanId)
    if (!bean) return
    const f = assessFreshness(bean.roastDate)
    setFreshness(f)
    setFreshnessTips(null)
    setTipsError(null)
    if (f && f.status !== 'peak' && f.status !== 'future') fetchFreshnessTips(bean, f)
  }, [detailBeanId, beans])

  const filteredBeans = useMemo(() => {
    let result = [...beans]
    if (search) result = result.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.origin.toLowerCase().includes(search.toLowerCase()))
    if (filter === 'low') result = result.filter(b => b.remainingGrams / b.totalGrams <= 0.3)
    if (filter === 'fav') result = result.filter(b => {
      const bBrws = brews.filter(br => br.beanId === b.id || ((!br.beanId || br.beanId === 'undefined') && br.beanName?.toLowerCase() === b.name?.toLowerCase()))
      return bBrws.length > 0 && (bBrws.reduce((s, bw) => s + bw.rating, 0) / bBrws.length) >= 4
    })
    return result.sort((a, b) => (b.id === activeBean?.id ? 1 : 0) - (a.id === activeBean?.id ? 1 : 0))
  }, [beans, brews, search, filter, activeBean])

  const totalStock = beans.reduce((s, b) => s + b.remainingGrams, 0)
  const lowCount = beans.filter(b => b.remainingGrams / b.totalGrams <= 0.2).length
  const avgRating = brews.length ? (brews.reduce((s, b) => s + b.rating, 0) / brews.length).toFixed(1) : '—'
  const detailBean = detailBeanId ? beans.find(b => b.id === detailBeanId) ?? null : null

  function openAdd() {
    setEditBean(null)
    setForm(EMPTY_FORM)
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
      roastLevel: detailBean.roastLevel || 'Medium', roastDate: normalizeDateInput(detailBean.roastDate || ''),
      totalGrams: String(detailBean.totalGrams), remainingGrams: String(detailBean.remainingGrams),
      notes: detailBean.notes || '',
    })
    setDetailBeanId(null)
    setShowForm(true)
  }

  function handleFormChange(field: keyof BeanFormState, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleDateChange(date: Date | null) {
    setForm(f => ({ ...f, roastDate: date ? toIsoDateString(date) : '' }))
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newEntries = files.map(file => ({ file, preview: URL.createObjectURL(file) }))
    setScanImages(prev => [...prev, ...newEntries])
    setScanError(null)
    setAiFilledFields(new Set())
    e.target.value = ''
  }

  function removeImage(idx: number) {
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
      const filled = new Set<string>()
      const next = { ...form }
      if (result.name) { next.name = result.name; filled.add('name') }
      if (result.origin) { next.origin = result.origin; filled.add('origin') }
      if (result.process) { next.process = result.process; filled.add('process') }
      if (result.roastLevel) { next.roastLevel = result.roastLevel; filled.add('roastLevel') }
      if (result.roastDate) { next.roastDate = normalizeDateInput(result.roastDate); filled.add('roastDate') }
      if (result.totalGrams) {
        const grams = parseGramValue(result.totalGrams)
        if (Number.isFinite(grams)) { next.totalGrams = String(grams); filled.add('totalGrams') }
      }
      if (result.notes) { next.notes = result.notes; filled.add('notes') }
      setForm(next)
      setAiFilledFields(filled)
    } catch (err) {
      setScanError((err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    const name = form.name.trim()
    const origin = form.origin.trim()
    if (!name) { setSaveError('Bean name is required.'); setSaving(false); return }
    if (!origin) { setSaveError('Origin is required.'); setSaving(false); return }

    const totalGrams = parseGramValue(form.totalGrams)
    const remainingGrams = form.remainingGrams ? parseGramValue(form.remainingGrams) : totalGrams
    if (!Number.isFinite(totalGrams) || totalGrams <= 0) { setSaveError('Total grams must be a valid number greater than 0.'); setSaving(false); return }
    if (!Number.isFinite(remainingGrams) || remainingGrams < 0) { setSaveError('Remaining grams must be a valid number.'); setSaving(false); return }
    if (remainingGrams > totalGrams) { setSaveError('Remaining grams cannot exceed total grams.'); setSaving(false); return }

    const bean: Partial<Bean> = {
      name, origin, process: form.process.trim(),
      roastLevel: form.roastLevel, roastDate: normalizeDateInput(form.roastDate) || null,
      totalGrams, remainingGrams, notes: form.notes.trim(),
    }
    try {
      if (editBean) await updateBean(editBean.id, bean)
      else await addBean(bean as Omit<Bean, 'id'>)
      setShowForm(false)
    } catch (err) {
      setSaveError((err as Error).message || 'Failed to save bean. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBean() {
    if (!detailBean || deleting) return
    const deletingActiveBean = detailBean.id === activeBean?.id
    const nextBean = beans.find(b => b.id !== detailBean.id)

    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteBean(detailBean.id)
      if (deletingActiveBean) {
        if (nextBean?.id) setActiveBeanId(nextBean.id)
        else localStorage.removeItem('artisanal_active_bean')
      }
      setDetailBeanId(null)
    } catch (err) {
      setDeleteError((err as Error)?.message || 'Failed to delete bean. Please try again.')
    } finally {
      setDeleting(false)
      confirmingDeleteRef.current = false
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
              {([['all', 'All'], ['low', 'Low Stock'], ['fav', 'Rated']] as [string, string][]).map(([f, label]) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}>{label}</button>
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
            { label: 'Beans in Cellar', value: beans.length, icon: 'grain', sub: `${activeBean?.name || ''} active`, warn: false },
            { label: 'Total Stock', value: `${totalStock}g`, icon: 'scale', sub: `across ${beans.length} bean${beans.length !== 1 ? 's' : ''}`, warn: false },
            { label: 'Low Stock Alerts', value: lowCount, icon: 'warning', sub: lowCount ? 'need restocking soon' : 'all stocked up', warn: lowCount > 0 },
            { label: 'Avg Brew Rating', value: avgRating, icon: 'star', sub: 'across all your brews', warn: false },
          ].map(it => (
            <div key={it.label} className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_2px_12px_rgba(62,39,35,0.04)]">
              <div className="flex items-center gap-3 mb-2">
                <span className={`material-symbols-outlined text-[18px] ${it.warn ? 'text-error' : 'text-on-surface-variant'}`}>{it.icon}</span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{it.label}</span>
              </div>
              <p className="font-headline text-2xl text-primary">{it.value}</p>
              <p className={`text-[11px] mt-0.5 ${it.warn ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>{it.sub}</p>
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
            {filteredBeans.map(bean => (
              <BeanCard
                key={bean.id}
                bean={bean}
                brews={brews}
                isActive={bean.id === activeBean?.id}
                onClick={() => setDetailBeanId(bean.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailBean && (
        <BeanDetailModal
          bean={detailBean}
          brews={brews}
          freshness={freshness}
          freshnessTips={freshnessTips}
          loadingTips={loadingTips}
          tipsError={tipsError}
          isActiveBean={detailBean.id === activeBean?.id}
          deleting={deleting}
          formatDate={formatDate}
          onClose={() => setDetailBeanId(null)}
          onSetActive={() => { setActiveBeanId(detailBean.id); setDetailBeanId(null) }}
          onBrew={() => { setActiveBeanId(detailBean.id); navigate('/brew-setup') }}
          onEdit={openEdit}
          onDelete={() => setShowDeleteConfirm(true)}
          onRetryTips={() => detailBean && freshness && fetchFreshnessTips(detailBean, freshness)}
        />
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && detailBean && (
        <ConfirmModal
          message={`Delete "${detailBean.name}"? This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          danger
          onConfirm={() => { setShowDeleteConfirm(false); handleDeleteBean() }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {deleteError && (
        <ConfirmModal
          message={deleteError}
          confirmLabel="OK"
          onConfirm={() => setDeleteError(null)}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <BeanFormModal
          editBean={editBean}
          form={form}
          scanImages={scanImages}
          scanning={scanning}
          scanError={scanError}
          aiFilledFields={aiFilledFields}
          saving={saving}
          saveError={saveError}
          onFormChange={handleFormChange}
          onDateChange={handleDateChange}
          onImageSelect={handleImageSelect}
          onRemoveImage={removeImage}
          onAIScan={handleAIScan}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </Layout>
  )
}
