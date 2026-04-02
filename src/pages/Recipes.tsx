import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import Stars from '../components/ui/Stars'
import type { Brew } from '../types/brew'
import { phasesDuration } from '../lib/brewUtils'

const METHOD_BADGE: Record<string, string> = {
  'V60': 'bg-primary text-white',
  'Chemex': 'bg-tertiary-container text-on-tertiary-container',
  'AeroPress': 'bg-surface-container-highest text-on-surface',
  'French Press': 'bg-surface-container text-on-surface-variant',
}

const IMAGES = [
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80',
  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80',
]

interface CommunityRecipe {
  method: string
  beanName: string
  dose: number
  water: number
  temp: number
  ratio: string
  grindSize: string
  brewTime: string
  rating: number
  tasteTags: string[]
  notes: string
}

const COMMUNITY: CommunityRecipe[] = [
  { method: 'V60', beanName: 'Ethiopia Yirgacheffe', dose: 18, water: 300, temp: 93, ratio: '1:16.7', grindSize: '24 clicks', brewTime: phasesDuration('V60'), rating: 5, tasteTags: ['Floral', 'Juicy', 'Bright'], notes: 'A clean, crisp extraction highlighting jasmine and citrus.' },
  { method: 'Chemex', beanName: 'Kenya Nyeri', dose: 25, water: 400, temp: 95, ratio: '1:16', grindSize: 'Medium-Coarse', brewTime: phasesDuration('Chemex'), rating: 5, tasteTags: ['Berry', 'Bright', 'Complex'], notes: 'Outstanding clarity. Let the thick filter do its work.' },
  { method: 'AeroPress', beanName: 'Colombia Huila', dose: 18, water: 250, temp: 93, ratio: '1:13.9', grindSize: 'Medium', brewTime: phasesDuration('AeroPress'), rating: 4, tasteTags: ['Balanced', 'Caramel', 'Smooth'], notes: 'Fast, concentrated extraction with honey sweetness.' },
]

type Recipe = (Brew | CommunityRecipe) & { id?: string; beanId?: string }

interface RecipeCardProps {
  recipe: Recipe
  idx: number
  canReplicate: boolean
  onUse: (recipe: Recipe) => void
}

function RecipeCard({ recipe, idx, canReplicate, onUse }: RecipeCardProps) {
  const extraction = (recipe as Brew).extraction
  return (
    <div className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(62,39,35,0.04)] hover:shadow-xl transition-all flex flex-col">
      <div className="h-44 overflow-hidden relative">
        <img src={IMAGES[idx % IMAGES.length]} alt={recipe.beanName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
        <div className="absolute inset-0 bg-gradient-to-t from-primary/50 to-transparent"></div>
        <div className="absolute top-3 left-3">
          <span className={`text-[9px] font-bold px-2.5 py-1 rounded uppercase tracking-wide ${METHOD_BADGE[recipe.method] || 'bg-white/90 text-primary'}`}>{recipe.method}</span>
        </div>
        <div className="absolute top-3 right-3">
          {extraction != null && extraction > 0 && (
            <span className="text-[9px] font-bold px-2 py-0.5 bg-white/90 text-primary rounded">{extraction}%</span>
          )}
        </div>
        <div className="absolute bottom-3 right-3 flex gap-0.5"><Stars rating={recipe.rating} size="text-xs" /></div>
      </div>
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div>
          <h4 className="font-headline text-base font-bold text-primary leading-tight">{recipe.beanName}</h4>
          <p className="text-[10px] text-on-surface-variant mt-0.5">{recipe.ratio} · {recipe.dose}g / {recipe.water}g · {recipe.temp}°C</p>
        </div>
        {(recipe.tasteTags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(recipe.tasteTags || []).slice(0, 4).map(t => (
              <span key={t} className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded text-[9px] font-bold uppercase">{t}</span>
            ))}
          </div>
        )}
        {recipe.notes && (
          <p className="text-[11px] text-on-surface-variant italic leading-relaxed border-l-2 border-outline-variant/30 pl-3">{recipe.notes}</p>
        )}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/10">
          {([['Grind', recipe.grindSize || '—'], ['Time', phasesDuration(recipe.method)], ['Temp', recipe.temp + '°C']] as [string, string][]).map(([l, v]) => (
            <div key={l} className="text-center">
              <p className="text-[9px] text-on-surface-variant uppercase font-bold mb-0.5">{l}</p>
              <p className="text-xs font-bold text-primary">{v}</p>
            </div>
          ))}
        </div>
        <button onClick={() => onUse(recipe)} className="mt-auto w-full py-2.5 brew-gradient text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-colors">
          {canReplicate ? 'Use This Recipe' : 'Try This Recipe'}
        </button>
      </div>
    </div>
  )
}

function matchesSearch(recipe: Recipe, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  return Boolean(
    recipe.beanName?.toLowerCase().includes(lower) ||
    recipe.method?.toLowerCase().includes(lower) ||
    (recipe.tasteTags || []).some(t => t.toLowerCase().includes(lower))
  )
}

export default function Recipes() {
  const { brews, beans, setPendingBrew, setActiveBeanId, getActiveBean } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const bestBrews = useMemo(() => {
    const top = [...brews].sort((a, b) => b.rating - a.rating || new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)
    return top.filter(r => matchesSearch(r, search))
  }, [brews, search])

  const communityRecipes = useMemo(() => {
    return COMMUNITY.filter(r => matchesSearch(r, search))
  }, [search])

  function replicateRecipe(r: Recipe) {
    const bean = beans.find(b => b.name === r.beanName) || getActiveBean()
    setPendingBrew({
      beanId: bean?.id || r.beanId, beanName: r.beanName,
      method: r.method, dose: r.dose, water: r.water, temp: r.temp,
      ratio: r.ratio, grindSize: r.grindSize, brewTime: r.brewTime,
      extraction: Number(((r.water / r.dose) * 1.2).toFixed(1)),
    })
    if (bean?.id) setActiveBeanId(bean.id)
    navigate('/brew-setup')
  }

  return (
    <Layout searchPlaceholder="Search recipes..." onSearch={setSearch}>
      <div className="max-w-[1440px] mx-auto px-4 py-6 md:px-10 md:py-10 space-y-8 md:space-y-10">
        <section className="space-y-1">
          <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Brew Intelligence</span>
          <h2 className="font-headline text-5xl font-bold text-primary leading-tight">Recipes</h2>
          <p className="text-on-surface-variant font-medium pt-1">Proven brewing recipes drawn from your best sessions and community favourites.</p>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-headline text-2xl font-bold text-primary">From Your Best Brews</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Your highest-rated sessions — one click to replicate</p>
            </div>
            <Link to="/analytics" className="text-xs font-bold text-primary underline underline-offset-4 hover:text-on-surface-variant transition-colors uppercase tracking-wide flex items-center gap-1">
              View Analytics <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
          {bestBrews.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {bestBrews.map((b, i) => <RecipeCard key={b.id} recipe={b} idx={i} canReplicate onUse={replicateRecipe} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="col-span-1 sm:col-span-2 md:col-span-3 py-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl mb-3 opacity-30 block">coffee</span>
                <p className="font-headline text-lg text-primary mb-1">No brews yet</p>
                <p className="text-sm mb-4">Log your first brew to save recipes from your best sessions.</p>
                <Link to="/brew-setup" className="brew-gradient inline-block text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest">Log First Brew</Link>
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="mb-6">
            <h3 className="font-headline text-2xl font-bold text-primary">Community Classics</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Proven recipes from the specialty coffee community</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {communityRecipes.map((r, i) => <RecipeCard key={i} recipe={r} idx={i + 1} canReplicate={false} onUse={replicateRecipe} />)}
          </div>
        </section>
      </div>
    </Layout>
  )
}
