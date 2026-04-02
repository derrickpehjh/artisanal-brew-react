import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="material-symbols-outlined text-primary opacity-20" style={{ fontSize: '96px', fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 48" }}>
        coffee_off
      </span>
      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">404 — Page Not Found</p>
        <h1 className="font-headline text-4xl font-bold text-primary">Over-extracted</h1>
        <p className="text-on-surface-variant text-sm max-w-xs">This page went past its brew window. Let's get you back to something good.</p>
      </div>
      <Link
        to="/"
        className="brew-gradient text-white px-8 py-3 rounded-full font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
      >
        Back to the Cellar
      </Link>
    </div>
  )
}
