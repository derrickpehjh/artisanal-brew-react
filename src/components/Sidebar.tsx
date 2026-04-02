import { useLocation, Link } from 'react-router-dom'

interface NavLink {
  to: string
  icon: string
  label: string
  fill: boolean
}

const NAV_LINKS: NavLink[] = [
  { to: '/', icon: 'home', label: 'Home', fill: true },
  { to: '/brew-setup', icon: 'coffee_maker', label: 'Log Brew', fill: true },
  { to: '/beans', icon: 'grain', label: 'Beans', fill: false },
  { to: '/analytics', icon: 'insert_chart', label: 'Analytics', fill: true },
  { to: '/recipes', icon: 'menu_book', label: 'Recipes', fill: false },
]

interface SidebarProps {
  /** Show the "New Brew" CTA button at the bottom (default: true) */
  showCta?: boolean
}

export default function Sidebar({ showCta = true }: SidebarProps) {
  const location = useLocation()
  const isActive = (to: string) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 bg-surface-container-low flex-col py-8 gap-y-8 z-50">
      <div className="px-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-surface-container-low text-xl" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>coffee</span>
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
              <span className="material-symbols-outlined text-[20px]" style={active ? { fontVariationSettings: "'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24" } : {}}>{link.icon}</span>
              <span className="text-sm">{link.label}</span>
            </Link>
          )
        })}
        <Link
          to="/settings"
          className={`mt-auto flex items-center gap-3 py-3 px-6 transition-colors ${isActive('/settings') ? 'border-l-2 border-primary font-bold text-primary bg-surface-container-high/50' : 'text-on-surface-variant font-medium hover:bg-surface-container-high hover:text-primary'}`}
        >
          <span className="material-symbols-outlined text-[20px]" style={isActive('/settings') ? { fontVariationSettings: "'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24" } : {}}>settings</span>
          <span className="text-sm">Settings</span>
        </Link>
      </nav>
      {showCta && (
        <div className="px-6">
          <Link to="/brew-setup" className="brew-gradient block w-full py-4 text-white rounded-md font-bold text-sm text-center tracking-wide shadow-lg hover:opacity-90 active:scale-[0.98] transition-all">New Brew</Link>
        </div>
      )}
    </aside>
  )
}
