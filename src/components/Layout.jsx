import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const NAV_LINKS = [
  { to: '/', icon: 'home', label: 'Home', fill: true },
  { to: '/brew-setup', icon: 'coffee_maker', label: 'Log Brew', fill: true },
  { to: '/beans', icon: 'grain', label: 'Beans', fill: false },
  { to: '/analytics', icon: 'insert_chart', label: 'Analytics', fill: true },
  { to: '/recipes', icon: 'menu_book', label: 'Recipes', fill: false },
]

export default function Layout({ children, searchPlaceholder = 'Search archives...', onSearch }) {
  const { user, signOut } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.name || 'Brewer'
  const displaySub = user?.email ? user.email.split('@')[0] : 'Artisan'
  const avatarUrl = meta.avatar_url || meta.picture

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  async function handleMenuSignOut(e) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      alert('Sign out failed: ' + (err?.message || 'Unknown error'))
    }
  }

  return (
    <div className="bg-background text-on-background min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 bg-surface-container-low flex-col py-8 gap-y-8 z-50">
        <div className="px-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-surface-container-low text-xl" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>coffee</span>
          </div>
          <div>
            <h1 className="font-headline text-lg leading-tight tracking-tight text-primary">The Artisanal Brew</h1>
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mt-0.5">Modern Cellar Edition</p>
          </div>
        </div>
        <nav className="flex-1 flex flex-col">
          {NAV_LINKS.map(link => {
            const active = isActive(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 py-3 px-6 transition-colors ${active ? 'border-l-2 border-primary font-bold text-primary bg-surface-container-high/50' : 'text-on-surface-variant font-medium hover:bg-surface-container-high hover:text-primary'}`}
              >
                <span className="material-symbols-outlined text-[20px]" style={active ? {fontVariationSettings:"'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24"} : {}}>{link.icon}</span>
                <span className="text-sm">{link.label}</span>
              </Link>
            )
          })}
          <Link
            to="/settings"
            className={`mt-auto flex items-center gap-3 py-3 px-6 transition-colors ${isActive('/settings') ? 'border-l-2 border-primary font-bold text-primary bg-surface-container-high/50' : 'text-on-surface-variant font-medium hover:bg-surface-container-high hover:text-primary'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={isActive('/settings') ? {fontVariationSettings:"'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24"} : {}}>settings</span>
            <span className="text-sm">Settings</span>
          </Link>
        </nav>
        <div className="px-6">
          <Link to="/brew-setup" className="brew-gradient block w-full py-4 text-white rounded-md font-bold text-sm text-center tracking-wide shadow-lg hover:opacity-90 active:scale-[0.98] transition-all">New Brew</Link>
        </div>
      </aside>

      {/* Top Bar */}
      <header className="fixed top-0 right-0 left-0 md:left-64 h-16 z-40 bg-background/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(62,39,35,0.08)]">
        <div className="flex items-center px-4 md:px-10 h-full max-w-[1440px] mx-auto w-full">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-container rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-base" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>coffee</span>
            </div>
            <span className="font-headline text-sm text-primary leading-tight">The Artisanal Brew</span>
          </div>
          {onSearch && (
            <div className="hidden md:flex items-center gap-3 bg-surface-container-high rounded-full px-4 py-2 w-96">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-on-surface-variant/60 text-on-surface outline-none"
                onChange={e => onSearch(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-4 md:gap-6 ml-auto">
            <button onClick={() => alert('No new notifications.')} className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-outline-variant/20">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-primary">{displayName}</p>
                <p className="text-[10px] text-on-surface-variant">{displaySub}</p>
              </div>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all"
                >
                  {avatarUrl
                    ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    : <span className="material-symbols-outlined text-on-surface-variant" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>account_circle</span>
                  }
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-11 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/15 w-52 py-2 z-50">
                    <div className="px-4 py-3 border-b border-outline-variant/10">
                      <p className="text-xs font-bold text-primary truncate">{displayName}</p>
                      <p className="text-[11px] text-on-surface-variant truncate">{user?.email || ''}</p>
                    </div>
                    <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors">
                      <span className="material-symbols-outlined text-[18px]">manage_accounts</span>Profile &amp; Settings
                    </Link>
                    <button onClick={handleMenuSignOut} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/30 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">logout</span>Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="ml-0 md:ml-64 pt-16 min-h-screen bg-surface pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-low border-t border-outline-variant/20 flex items-stretch">
        {[...NAV_LINKS, { to: '/settings', icon: 'settings', label: 'Settings', fill: false }].map(link => {
          const active = isActive(link.to)
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${active ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined text-[22px]" style={active ? {fontVariationSettings:"'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24"} : {}}>{link.icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{link.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
