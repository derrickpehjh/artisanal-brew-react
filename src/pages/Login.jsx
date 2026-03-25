import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const LAST_GOOGLE_EMAIL_KEY = 'artisanal_last_google_email'

export default function Login() {
  const { user, supabase } = useApp()
  const navigate = useNavigate()
  const [lastGoogleEmail, setLastGoogleEmail] = useState(() => localStorage.getItem(LAST_GOOGLE_EMAIL_KEY) || '')

  useEffect(() => {
    if (user) {
      if (user.email) {
        localStorage.setItem(LAST_GOOGLE_EMAIL_KEY, user.email)
        setLastGoogleEmail(user.email)
      }
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  function buildRedirectUrl() {
    if (!/^https?:$/.test(window.location.protocol)) return null
    return new URL('/', window.location.href).toString()
  }

  async function signInWithGoogle(forceAccountPicker = false) {
    const redirectTo = buildRedirectUrl()
    const options = { ...(redirectTo ? { redirectTo } : {}) }
    const lastEmail = localStorage.getItem(LAST_GOOGLE_EMAIL_KEY)
    if (forceAccountPicker) {
      // Force the Google account chooser instead of reusing the last account silently.
      options.queryParams = {
        prompt: 'select_account',
        access_type: 'offline',
        include_granted_scopes: 'true',
      }
    } else if (lastEmail) {
      // Hint Google to reuse the previously successful account for faster sign-in.
      options.queryParams = { login_hint: lastEmail }
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options })
    if (error) {
      const suffix = redirectTo ? `\nExpected redirect URL: ${redirectTo}` : '\nOpen this app over http://localhost for OAuth sign-in.'
      alert('Sign-in failed: ' + error.message + suffix)
    }
  }

  async function signInWithAnotherGoogleAccount() {
    // Clear local Supabase auth state before launching chooser flow.
    await supabase.auth.signOut({ scope: 'local' })
    await signInWithGoogle(true)
  }

  async function continueAsDemo() {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) { alert('Demo mode unavailable: ' + error.message); return }
    navigate('/', { replace: true })
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex">
      {/* Left Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative brew-gradient flex-col justify-between p-14 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/5 pointer-events-none"></div>
        <div className="absolute -bottom-32 -left-20 w-[500px] h-[500px] rounded-full bg-white/5 pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>coffee</span>
          </div>
          <div>
            <h1 className="font-headline text-white text-lg leading-tight tracking-tight">The Artisanal Brew</h1>
            <p className="text-white/50 text-[9px] uppercase tracking-widest font-bold">Modern Cellar Edition</p>
          </div>
        </div>
        <div className="relative z-10 flex-1 flex items-center justify-center py-12">
          <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=700&q=80" alt="Pour over coffee brewing" className="w-full max-w-sm rounded-2xl object-cover shadow-2xl opacity-80" style={{aspectRatio:'4/5'}} />
        </div>
        <div className="relative z-10">
          <blockquote className="font-headline text-2xl text-white leading-snug mb-4">"Every great cup begins with intention."</blockquote>
          <p className="text-white/50 text-xs font-medium uppercase tracking-widest">Log. Analyse. Perfect.</p>
        </div>
      </div>

      {/* Right Form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-xl" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>coffee</span>
            </div>
            <h1 className="font-headline text-lg tracking-tight text-primary">The Artisanal Brew</h1>
          </div>
          <div className="mb-10">
            <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Welcome back</span>
            <h2 className="font-headline text-4xl font-bold text-primary leading-tight mt-2">Sign in to your cellar</h2>
            <p className="text-on-surface-variant text-sm mt-3 leading-relaxed">Track your brews, analyse extractions, and perfect your craft — all in one place.</p>
          </div>
          <div className="flex flex-col gap-4">
            <button onClick={() => signInWithGoogle(false)} className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl px-6 py-4 font-bold text-on-background hover:bg-surface-container-high transition-colors shadow-sm text-sm group">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
              <span className="material-symbols-outlined text-[16px] opacity-0 group-hover:opacity-60 transition-opacity ml-auto">arrow_forward</span>
            </button>
            {lastGoogleEmail && (
              <p className="text-[11px] text-on-surface-variant -mt-2 px-1">
                Use last account: <span className="font-semibold text-primary">{lastGoogleEmail}</span>
              </p>
            )}
            <button onClick={signInWithAnotherGoogleAccount} className="w-full flex items-center justify-center gap-2 bg-surface-container-low text-on-surface-variant rounded-xl px-6 py-3.5 font-bold text-sm hover:bg-surface-container-highest hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              Continue with Another Google Account
            </button>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-outline-variant/30"></div>
              <span className="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">or</span>
              <div className="h-px flex-1 bg-outline-variant/30"></div>
            </div>
            <button onClick={continueAsDemo} className="w-full flex items-center justify-center gap-2 bg-surface-container-high text-on-surface-variant rounded-xl px-6 py-4 font-bold text-sm hover:bg-surface-container-highest hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">science</span>
              Continue in Demo Mode
            </button>
          </div>
          <p className="text-center text-[11px] text-on-surface-variant mt-10 leading-relaxed">
            By signing in, you agree to store your brew data locally in your browser. Your brew data is securely stored in Supabase.
          </p>
        </div>
      </div>
    </div>
  )
}
