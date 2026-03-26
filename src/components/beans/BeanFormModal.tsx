import { useRef } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import type { Bean } from '../../types/bean'
import type { BeanFormState } from '../../types/bean'
import { ROAST_LEVELS } from '../../types/bean'

interface ScanImage {
  file: File
  preview: string
}

interface BeanFormModalProps {
  editBean: Bean | null
  form: BeanFormState
  scanImages: ScanImage[]
  scanning: boolean
  scanError: string | null
  aiFilledFields: Set<string>
  saving: boolean
  saveError: string | null
  onFormChange: (field: keyof BeanFormState, value: string) => void
  onDateChange: (date: Date | null) => void
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: (idx: number) => void
  onAIScan: () => void
  onSave: (e: React.FormEvent) => void
  onClose: () => void
}

function toIsoDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIsoDate(value: string): Date | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = new Date(`${raw}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function BeanFormModal({
  editBean, form, scanImages, scanning, scanError, aiFilledFields, saving, saveError,
  onFormChange, onDateChange, onImageSelect, onRemoveImage, onAIScan, onSave, onClose,
}: BeanFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const inputCls = (field: string) =>
    `w-full rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 outline-none transition-colors ${aiFilledFields.has(field) ? 'bg-tertiary-fixed/40 focus:ring-tertiary/30' : 'bg-surface-container focus:ring-primary/30'}`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm"></div>
      <div className="relative bg-surface-container-lowest rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="brew-gradient px-8 pt-7 pb-6 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-xl text-white">{editBean ? 'Edit Bean' : 'Add New Bean'}</h3>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <form onSubmit={onSave} className="px-8 py-6 space-y-5">
          {/* AI Image Scan — only show when adding */}
          {!editBean && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Scan Bean Bag with AI</label>
              <div className="flex flex-wrap gap-2">
                {scanImages.map((s, idx) => (
                  <div key={idx} className="relative w-20 h-20 shrink-0">
                    <img src={s.preview} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-outline-variant/20" />
                    <button
                      type="button"
                      onClick={() => onRemoveImage(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-on-surface-variant hover:border-primary/40 hover:text-primary hover:bg-surface-container-low transition-all ${scanImages.length === 0 ? 'w-full h-auto py-6 border-outline-variant/50' : 'w-20 h-20 border-outline-variant/40'}`}
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
              {scanImages.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onAIScan}
                      disabled={scanning}
                      className="brew-gradient text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
                    >
                      {scanning ? (
                        <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Analysing…</>
                      ) : (
                        <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>auto_awesome</span>Auto-fill with AI</>
                      )}
                    </button>
                    <span className="text-[10px] text-on-surface-variant">{scanImages.length} photo{scanImages.length !== 1 ? 's' : ''} selected</span>
                  </div>
                  {aiFilledFields.size > 0 && (
                    <p className="text-[10px] text-tertiary font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>check_circle</span>
                      {aiFilledFields.size} field{aiFilledFields.size !== 1 ? 's' : ''} filled — review below
                    </p>
                  )}
                  {scanError && <p className="text-[10px] text-error font-medium">{scanError}</p>}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onImageSelect} className="hidden" />
              {aiFilledFields.size > 0 && <div className="mt-3 h-px bg-outline-variant/20" />}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                Bean Name *{aiFilledFields.has('name') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
              </label>
              <input required value={form.name} onChange={e => onFormChange('name', e.target.value)} placeholder="e.g. Ethiopia Yirgacheffe" className={inputCls('name')} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                Origin *{aiFilledFields.has('origin') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
              </label>
              <input required value={form.origin} onChange={e => onFormChange('origin', e.target.value)} placeholder="e.g. Ethiopia" className={inputCls('origin')} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                Process{aiFilledFields.has('process') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
              </label>
              <input value={form.process} onChange={e => onFormChange('process', e.target.value)} placeholder="e.g. Washed Process" className={inputCls('process')} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                Roast Level{aiFilledFields.has('roastLevel') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
              </label>
              <select value={form.roastLevel} onChange={e => onFormChange('roastLevel', e.target.value)} className={inputCls('roastLevel')}>
                {ROAST_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                Roast Date{aiFilledFields.has('roastDate') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
              </label>
              <DatePicker
                selected={parseIsoDate(form.roastDate)}
                onChange={(date: Date | null) => onDateChange(date)}
                dateFormat="MMM d, yyyy"
                placeholderText="Select roast date"
                maxDate={new Date()}
                isClearable
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                wrapperClassName="w-full"
                className={inputCls('roastDate')}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                Total Grams *{aiFilledFields.has('totalGrams') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
              </label>
              <input type="number" required min="1" value={form.totalGrams} onChange={e => onFormChange('totalGrams', e.target.value)} placeholder="250" className={inputCls('totalGrams')} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">Remaining Grams</label>
              <input type="number" min="0" value={form.remainingGrams} onChange={e => onFormChange('remainingGrams', e.target.value)} placeholder="Same as total" className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface border-none focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">
                Tasting Notes{aiFilledFields.has('notes') && <span className="ml-2 text-tertiary normal-case tracking-normal font-medium">· AI filled</span>}
              </label>
              <textarea rows={2} value={form.notes} onChange={e => onFormChange('notes', e.target.value)} placeholder="Describe the flavour profile..." className={inputCls('notes') + ' resize-none'} />
            </div>
          </div>
          {saveError && <p className="text-xs text-error font-medium">{saveError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-surface-container rounded-xl text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 brew-gradient py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60">
              {saving
                ? <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Saving…</span>
                : 'Save Bean'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export { toIsoDateString }
