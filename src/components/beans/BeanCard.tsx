import type { Bean } from '../../types/bean'
import type { Brew } from '../../types/brew'
import Stars from '../ui/Stars'

function roastColor(level: string): string {
  const map: Record<string, string> = {
    'Light': 'bg-amber-100 text-amber-800',
    'Light-Medium': 'bg-amber-200 text-amber-900',
    'Medium': 'bg-orange-200 text-orange-900',
    'Medium-Dark': 'bg-orange-300 text-orange-950',
    'Dark': 'bg-stone-300 text-stone-900',
  }
  return map[level] || 'bg-surface-container-highest text-on-surface-variant'
}

function stockLabel(remaining: number, total: number): { label: string; cls: string } {
  const pct = total ? Math.round((remaining / total) * 100) : 0
  if (pct <= 0) return { label: 'Empty', cls: 'text-error' }
  if (pct <= 20) return { label: 'Low Stock', cls: 'text-error' }
  if (pct <= 50) return { label: 'Running Low', cls: 'text-amber-700' }
  return { label: 'Well Stocked', cls: 'text-tertiary' }
}

interface BeanCardProps {
  bean: Bean
  brews: Brew[]
  isActive: boolean
  onClick: () => void
}

export default function BeanCard({ bean, brews, isActive, onClick }: BeanCardProps) {
  const pct = bean.totalGrams ? Math.round((bean.remainingGrams / bean.totalGrams) * 100) : 0
  const sl = stockLabel(bean.remainingGrams, bean.totalGrams)
  const beanBrews = brews.filter(br =>
    br.beanId === bean.id ||
    ((!br.beanId || br.beanId === 'undefined') && br.beanName?.toLowerCase().replace(/\s+/g, ' ').trim() === bean.name?.toLowerCase().replace(/\s+/g, ' ').trim())
  )
  const avgR = beanBrews.length ? (beanBrews.reduce((s, b) => s + b.rating, 0) / beanBrews.length).toFixed(1) : null

  return (
    <div
      onClick={onClick}
      className={`bg-surface-container-lowest rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-all duration-200 hover:shadow-[0_8px_32px_rgba(62,39,35,0.10)] ${isActive ? 'shadow-[0_0_0_2px_#271310,0_4px_24px_rgba(62,39,35,0.12)]' : 'shadow-[0_4px_20px_rgba(62,39,35,0.04)]'}`}
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
            <span className={sl.cls}>{sl.label}</span>
            <span>{bean.remainingGrams}g / {bean.totalGrams}g</span>
          </div>
          <div className="h-1 bg-on-primary/20 rounded-full overflow-hidden">
            <div className="h-full bg-on-primary/70 rounded-full transition-all duration-500" style={{ width: pct + '%' }}></div>
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
            <Stars rating={Math.round(parseFloat(avgR || '0'))} size="text-xs" />
            <span className="text-[10px] font-bold text-on-surface-variant ml-1">{avgR || '—'}</span>
          </div>
          <div className="text-right">
            {avgR
              ? <p className="text-xs font-bold text-primary">{avgR} <span className="text-on-surface-variant font-medium">your avg</span></p>
              : <p className="text-xs text-on-surface-variant">No brews yet</p>
            }
            <p className="text-[10px] text-on-surface-variant">{beanBrews.length} brew{beanBrews.length !== 1 ? 's' : ''} logged</p>
          </div>
        </div>
      </div>
    </div>
  )
}
