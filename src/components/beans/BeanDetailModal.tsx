import type { Bean } from '../../types/bean'
import type { Brew } from '../../types/brew'
import type { FreshnessResult } from '../../types/ai'
import Stars from '../ui/Stars'

interface BeanDetailModalProps {
  bean: Bean
  brews: Brew[]
  freshness: FreshnessResult | null
  freshnessTips: string | null
  loadingTips: boolean
  tipsError: string | null
  isActiveBean: boolean
  deleting: boolean
  formatDate: (iso: string) => string
  onClose: () => void
  onSetActive: () => void
  onBrew: () => void
  onEdit: () => void
  onDelete: () => void
  onRetryTips: () => void
}

export default function BeanDetailModal({
  bean, brews, freshness, freshnessTips, loadingTips, tipsError,
  isActiveBean, deleting, formatDate,
  onClose, onSetActive, onBrew, onEdit, onDelete, onRetryTips,
}: BeanDetailModalProps) {
  const detailPct = bean.totalGrams ? Math.round((bean.remainingGrams / bean.totalGrams) * 100) : 0
  const beanBrews = brews.filter(br =>
    br.beanId === bean.id ||
    ((!br.beanId || br.beanId === 'undefined') && br.beanName?.toLowerCase().replace(/\s+/g, ' ').trim() === bean.name?.toLowerCase().replace(/\s+/g, ' ').trim())
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm"></div>
      <div className="relative bg-surface-container-lowest rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="brew-gradient px-8 pt-8 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/60 font-bold mb-1">{bean.origin}</p>
              <h3 className="font-headline text-2xl text-white leading-tight">{bean.name}</h3>
              <p className="text-sm text-white/70 mt-1">{bean.process}</p>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors mt-1">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-[10px] text-white/60 font-bold uppercase tracking-wide mb-1.5">
              <span>Stock Remaining</span>
              <span>{bean.remainingGrams}g of {bean.totalGrams}g</span>
            </div>
            <div className="h-1.5 bg-on-primary/20 rounded-full overflow-hidden">
              <div className="h-full bg-on-primary/80 rounded-full transition-all duration-500" style={{ width: detailPct + '%' }}></div>
            </div>
          </div>
        </div>
        <div className="px-8 py-6 grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Bean Profile</p>
              <div className="space-y-2.5">
                {([['Roast Level', bean.roastLevel || '—'], ['Roast Date', bean.roastDate || '—'], ['Total Purchased', bean.totalGrams + 'g'], ['Remaining', bean.remainingGrams + 'g']] as [string, string][]).map(([l, v]) => (
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
                              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>auto_awesome</span>
                              AI Compensation Tips
                            </p>
                            <p className="text-[10px] text-on-surface leading-relaxed whitespace-pre-line">{freshnessTips}</p>
                          </div>
                        ) : tipsError ? (
                          <div className="mt-1 p-2 bg-error-container/20 rounded-lg">
                            <p className="text-[10px] text-error font-medium mb-1">{tipsError}</p>
                            <button onClick={onRetryTips} className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline">
                              <span className="material-symbols-outlined text-[12px]">refresh</span>Retry
                            </button>
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
              {beanBrews.length ? (
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Total Brews</span><span className="font-semibold text-on-surface">{beanBrews.length}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Avg Rating</span><span className="font-semibold text-on-surface">{(beanBrews.reduce((s, b) => s + b.rating, 0) / beanBrews.length).toFixed(1)} / 5</span></div>
                  <div className="flex justify-between text-sm"><span className="text-on-surface-variant">Consumed</span><span className="font-semibold text-on-surface">{bean.totalGrams - bean.remainingGrams}g</span></div>
                </div>
              ) : <p className="text-sm text-on-surface-variant italic">No brews logged yet.</p>}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Tasting Notes</p>
              <p className="text-sm text-on-surface leading-relaxed italic">{bean.notes || 'No tasting notes added yet.'}</p>
            </div>
            {beanBrews[0] && (
              <div className="bg-surface-container rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Last Brew</p>
                <div className="text-sm text-on-surface space-y-1">
                  <div className="flex justify-between"><span className="text-on-surface-variant">Method</span><span className="font-semibold">{beanBrews[0].method}</span></div>
                  <div className="flex justify-between"><span className="text-on-surface-variant">Rating</span><div className="flex"><Stars rating={beanBrews[0].rating} size="text-xs" /></div></div>
                  <div className="flex justify-between"><span className="text-on-surface-variant">Date</span><span className="font-semibold">{formatDate(beanBrews[0].date)}</span></div>
                </div>
              </div>
            )}
            <div className="mt-auto flex flex-col gap-2.5 pt-2">
              <button
                onClick={onSetActive}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${isActiveBean ? 'bg-surface-container-highest text-on-surface-variant cursor-default' : 'bg-tertiary-fixed text-tertiary hover:bg-tertiary hover:text-on-tertiary'}`}
                disabled={isActiveBean}
              >
                {isActiveBean ? 'Currently Active Bean' : 'Set as Active Bean'}
              </button>
              {bean.remainingGrams <= 0 ? (
                <div className="w-full py-3 rounded-xl bg-error-container/30 text-error text-sm font-bold text-center flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  Out of Stock — Refill to Brew
                </div>
              ) : (
                <button onClick={onBrew} className="w-full brew-gradient py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all">
                  Brew This Bean
                </button>
              )}
              <button onClick={onEdit} className="w-full bg-surface-container py-3 rounded-xl text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors">
                Edit Details
              </button>
              <button
                onClick={onDelete}
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
  )
}
