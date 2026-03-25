import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import { Link } from 'react-router-dom'

const IMAGES = [
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80',
  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80',
]

const COMMUNITY = [
  { method:'V60', beanName:'Ethiopia Yirgacheffe', dose:18, water:300, temp:93, ratio:'1:16.7', grindSize:'24 clicks', brewTime:'3:15', rating:5, tasteTags:['Floral','Juicy','Bright'], notes:'A clean, crisp extraction highlighting jasmine and citrus.' },
  { method:'Chemex', beanName:'Kenya Nyeri', dose:25, water:400, temp:95, ratio:'1:16', grindSize:'Medium-Coarse', brewTime:'4:30', rating:5, tasteTags:['Berry','Bright','Complex'], notes:'Outstanding clarity. Let the thick filter do its work.' },
  { method:'AeroPress', beanName:'Colombia Huila', dose:18, water:250, temp:93, ratio:'1:13.9', grindSize:'Medium', brewTime:'1:30', rating:4, tasteTags:['Balanced','Caramel','Smooth'], notes:'Fast, concentrated extraction with honey sweetness.' },
]

function Stars({ rating }) {
  return (
    <>{[1,2,3,4,5].map(i => (
      <span key={i} className="material-symbols-outlined text-primary text-xs" style={{fontVariationSettings:`'FILL' ${i<=rating?1:0},'wght' 400,'GRAD' 0,'opsz' 24`}}>star</span>
    ))}</>
  )
}

function RecipeCard({ recipe, idx, canReplicate, onUse }) {
  return (
    <div className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(62,39,35,0.04)] hover:shadow-xl transition-all flex flex-col">
      <div className="h-44 overflow-hidden relative">
        <img src={IMAGES[idx % IMAGES.length]} alt={recipe.beanName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded text-[10px] font-bold text-primary uppercase tracking-wide">{recipe.method}</div>
        <div className="absolute top-3 right-3 flex gap-0.5"><Stars rating={recipe.rating} /></div>
      </div>
      <div className="p-6 flex flex-col flex-1 gap-4">
        <div>
          <h4 className="font-headline text-lg font-bold text-primary leading-tight">{recipe.beanName}</h4>
          <p className="text-xs text-on-surface-variant mt-1">{recipe.ratio} &bull; {recipe.dose}g / {recipe.water}g &bull; {recipe.temp}°C</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(recipe.tasteTags||[]).map(t => (
            <span key={t} className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded text-[10px] font-bold uppercase">{t}</span>
          ))}
        </div>
        {recipe.notes && <p className="text-xs text-on-surface-variant italic leading-relaxed border-l-2 border-outline-variant/30 pl-3">{recipe.notes}</p>}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/10">
          {[['Grind',recipe.grindSize||'—'],['Time',recipe.brewTime||'—'],['Temp',recipe.temp+'°C']].map(([l,v]) => (
            <div key={l} className="text-center">
              <p className="text-[9px] text-on-surface-variant uppercase font-bold mb-0.5">{l}</p>
              <p className="text-xs font-bold text-primary">{v}</p>
            </div>
          ))}
        </div>
        <button onClick={() => onUse(recipe)} className="mt-auto w-full py-2.5 brew-gradient text-white rounded-md font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-colors">
          {canReplicate ? 'Use This Recipe' : 'Try This Recipe'}
        </button>
      </div>
    </div>
  )
}

function matchesSearch(recipe, q) {
  if (!q) return true
  const lower = q.toLowerCase()
  return (
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
    const top = [...brews].sort((a,b) => b.rating - a.rating || new Date(b.date)-new Date(a.date)).slice(0, 6)
    return top.filter(r => matchesSearch(r, search))
  }, [brews, search])

  const communityRecipes = useMemo(() => {
    return COMMUNITY.filter(r => matchesSearch(r, search))
  }, [search])

  function replicateRecipe(r) {
    const bean = beans.find(b => b.name === r.beanName) || getActiveBean()
    setPendingBrew({
      beanId: bean?.id || r.beanId, beanName: r.beanName,
      method: r.method, dose: r.dose, water: r.water, temp: r.temp,
      ratio: r.ratio, grindSize: r.grindSize, brewTime: r.brewTime,
      extraction: Number(((r.dose / r.water) * 100 * 1.2).toFixed(1)),
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

        {/* From Best Brews */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline text-2xl font-bold text-primary">From Your Best Brews</h3>
            <Link to="/analytics" className="text-xs font-bold text-primary underline underline-offset-4 hover:text-on-surface-variant transition-colors uppercase tracking-wide">View Analytics</Link>
          </div>
          {bestBrews.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {bestBrews.map((b,i) => <RecipeCard key={b.id} recipe={b} idx={i} canReplicate onUse={replicateRecipe} />)}
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

        {/* Community Classics */}
        <section>
          <h3 className="font-headline text-2xl font-bold text-primary mb-6">Community Classics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {communityRecipes.map((r,i) => <RecipeCard key={i} recipe={r} idx={i+1} canReplicate={false} onUse={replicateRecipe} />)}
          </div>
        </section>
      </div>
    </Layout>
  )
}
