import type { BrewAnalysis } from '../../types/ai'

interface AISommelierCardProps {
  brewAnalysis: BrewAnalysis | null
  loadingAnalysis: boolean
  onRefresh: () => void
  onApplyToNext: () => void
}

export default function AISommelierCard({
  brewAnalysis, loadingAnalysis, onRefresh, onApplyToNext,
}: AISommelierCardProps) {
  return (
    <div className="relative h-full min-h-[560px] rounded-xl overflow-hidden bg-primary-container shadow-2xl">
      <img
        src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"
        alt="Coffee steam"
        className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-transparent"></div>
      <div className="relative h-full flex flex-col justify-end p-9">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-tertiary flex items-center justify-center">
              <span
                className="material-symbols-outlined text-tertiary-fixed text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}
              >
                auto_awesome
              </span>
            </div>
            <div>
              <h4 className="font-headline text-lg text-white">AI Sommelier</h4>
              <p className="text-xs text-on-primary-container">Personalised Brewing Tip</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loadingAnalysis}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-40"
            title="Refresh analysis"
          >
            <span className={`material-symbols-outlined text-white text-[16px] ${loadingAnalysis ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
        {loadingAnalysis ? (
          <div className="flex-1 flex flex-col justify-end gap-3 mb-7">
            <div className="h-7 bg-white/20 rounded animate-pulse w-4/5"></div>
            <div className="h-4 bg-white/15 rounded animate-pulse w-full"></div>
            <div className="h-4 bg-white/15 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-white/15 rounded animate-pulse w-5/6"></div>
          </div>
        ) : brewAnalysis ? (
          <>
            <h3 className="font-headline text-2xl leading-snug text-white mb-5">{brewAnalysis.headline}</h3>
            <p className="text-white/75 text-sm leading-relaxed mb-7">{brewAnalysis.tip}</p>
          </>
        ) : (
          <div className="mb-7">
            <p className="text-white/60 text-sm italic">Could not load analysis. Tap refresh to try again.</p>
          </div>
        )}
        <button
          onClick={onApplyToNext}
          className="w-full py-4 bg-white text-primary font-bold rounded-md hover:bg-surface-bright transition-colors text-xs uppercase tracking-widest"
        >
          Apply to Next Brew
        </button>
      </div>
    </div>
  )
}
