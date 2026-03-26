import type { GrindSuggestion } from '../../types/ai'

interface GrindSuggestionCardProps {
  loadingSuggestion: boolean
  grindSuggestion: GrindSuggestion | null
}

export default function GrindSuggestionCard({ loadingSuggestion, grindSuggestion }: GrindSuggestionCardProps) {
  if (loadingSuggestion) {
    return (
      <div className="bg-surface-container rounded-xl p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-primary animate-spin text-[18px]">progress_activity</span>
        <span className="text-xs text-on-surface-variant font-medium">Getting AI grind tip…</span>
      </div>
    )
  }

  if (!grindSuggestion) return null

  const directionIcon =
    grindSuggestion.direction === 'finer' ? 'arrow_upward'
    : grindSuggestion.direction === 'coarser' ? 'arrow_downward'
    : 'check'
  const directionColor =
    grindSuggestion.direction === 'finer' ? 'text-tertiary'
    : grindSuggestion.direction === 'coarser' ? 'text-amber-700'
    : 'text-primary'

  return (
    <div className="bg-surface-container rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="material-symbols-outlined text-[16px]"
          style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}
        >
          auto_awesome
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">AI Grind Tip</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`material-symbols-outlined text-xl ${directionColor}`}
          style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}
        >
          {directionIcon}
        </span>
        <span className="font-bold text-sm text-primary">{grindSuggestion.amount}</span>
      </div>
      <p className="text-xs text-on-surface-variant leading-relaxed">{grindSuggestion.reasoning}</p>
      <p className="text-xs text-primary font-medium border-t border-outline-variant/20 pt-2">{grindSuggestion.tip}</p>
    </div>
  )
}
