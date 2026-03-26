interface RatingPanelProps {
  rating: number
  onRatingChange: (rating: number) => void
}

export default function RatingPanel({ rating, onRatingChange }: RatingPanelProps) {
  return (
    <div className="bg-surface-container-lowest p-7 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
      <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-6">Overall Satisfaction</h3>
      <div className="flex justify-between items-end gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            onClick={() => onRatingChange(s)}
            className={`group flex flex-col items-center gap-2 transition-all ${s === rating ? 'scale-110' : 'opacity-30 grayscale hover:opacity-100 hover:grayscale-0'}`}
          >
            <span
              className={`material-symbols-outlined text-primary transition-all group-hover:scale-110 ${s === rating ? 'text-4xl drop-shadow-[0_0_8px_rgba(39,19,16,0.3)]' : 'text-3xl'}`}
              style={{ fontVariationSettings: `'FILL' ${s <= rating ? 1 : 0},'wght' 400,'GRAD' 0,'opsz' 24` }}
            >
              coffee
            </span>
            <span className={`text-[10px] font-bold ${s === rating ? 'text-primary' : 'text-on-surface-variant'}`}>{s}</span>
          </button>
        ))}
      </div>
      <p className="text-center mt-4 text-xs text-on-surface-variant font-medium">Rating: {rating} / 5</p>
    </div>
  )
}
