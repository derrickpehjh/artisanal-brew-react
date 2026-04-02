import { Component, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Beans from './pages/Beans'
import BrewSetup from './pages/BrewSetup'
import GuidedBrew from './pages/GuidedBrew'
import TasteAnalysis from './pages/TasteAnalysis'
import Analytics from './pages/Analytics'
import Recipes from './pages/Recipes'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background gap-4 p-8 text-center">
          <span className="material-symbols-outlined text-error" style={{ fontSize: '48px' }}>error</span>
          <h1 className="font-headline text-2xl text-primary font-bold">Something went wrong</h1>
          <p className="text-sm text-on-surface-variant max-w-md">{(this.state.error as Error).message}</p>
          <button
            onClick={() => window.location.reload()}
            className="brew-gradient text-white px-6 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-all mt-2"
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp()
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
      <div className="loading-brew-icon">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '52px', fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 48" }}>coffee</span>
      </div>
      <p className="font-headline text-xl text-primary font-bold mt-2">Artisanal Brew</p>
      <div className="flex gap-1.5">
        <span className="loading-brew-dot" style={{ animationDelay: '0ms' }}></span>
        <span className="loading-brew-dot" style={{ animationDelay: '180ms' }}></span>
        <span className="loading-brew-dot" style={{ animationDelay: '360ms' }}></span>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/beans" element={<ProtectedRoute><Beans /></ProtectedRoute>} />
        <Route path="/brew-setup" element={<ProtectedRoute><BrewSetup /></ProtectedRoute>} />
        <Route path="/guided-brew" element={<ProtectedRoute><GuidedBrew /></ProtectedRoute>} />
        <Route path="/taste-analysis" element={<ProtectedRoute><TasteAnalysis /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
