import { useState } from 'react'

interface TasteTagPanelProps {
  tags: Set<string>
  availTags: string[]
  notes: string
  onToggleTag: (tag: string) => void
  onAddCustomTag: (tag: string) => void
  onNotesChange: (notes: string) => void
}

export default function TasteTagPanel({
  tags, availTags, notes, onToggleTag, onAddCustomTag, onNotesChange,
}: TasteTagPanelProps) {
  const [customTagInput, setCustomTagInput] = useState('')
  const [showCustomTagInput, setShowCustomTagInput] = useState(false)

  function submitCustomTag() {
    const t = customTagInput.trim()
    if (!t) return
    onAddCustomTag(t)
    setCustomTagInput('')
    setShowCustomTagInput(false)
  }

  return (
    <>
      <div className="bg-surface-container-lowest p-7 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
        <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-5">Taste Profile</h3>
        <div className="flex flex-wrap gap-2.5">
          {availTags.map(t => (
            <button
              key={t}
              onClick={() => onToggleTag(t)}
              className={`px-4 py-2 text-xs font-bold rounded-full transition-all active:scale-95 ${tags.has(t) ? 'tag-active' : 'tag-inactive hover:bg-surface-container-highest'}`}
            >
              {t}
            </button>
          ))}
          {showCustomTagInput ? (
            <div className="flex items-center gap-1.5 w-full mt-1">
              <input
                autoFocus
                value={customTagInput}
                onChange={e => setCustomTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitCustomTag()
                  if (e.key === 'Escape') { setShowCustomTagInput(false); setCustomTagInput('') }
                }}
                placeholder="e.g. Berry"
                className="flex-1 bg-surface-container rounded-full px-4 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary/30 border-none"
              />
              <button onClick={submitCustomTag} className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-full hover:opacity-90 transition-opacity">Add</button>
              <button onClick={() => { setShowCustomTagInput(false); setCustomTagInput('') }} className="px-3 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full hover:bg-surface-container-highest transition-colors">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomTagInput(true)}
              className="px-4 py-2 border border-dashed border-outline-variant text-on-surface-variant text-xs font-bold rounded-full flex items-center gap-1 hover:border-outline hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>Add Custom
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface-container-lowest p-7 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
        <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Tasting Notes</h3>
        <textarea
          rows={4}
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          className="w-full bg-surface-container-low rounded-lg p-3 text-sm text-on-surface resize-none border-none focus:ring-1 focus:ring-primary/30 outline-none placeholder:text-on-surface-variant/50 italic"
          placeholder="Describe the flavour, body, finish..."
        />
      </div>
    </>
  )
}
