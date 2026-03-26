import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useApp } from './context/AppContext'

const Login        = lazy(() => import('./pages/Login'))
const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Beans        = lazy(() => import('./pages/Beans'))
const BrewSetup    = lazy(() => import('./pages/BrewSetup'))
const GuidedBrew   = lazy(() => import('./pages/GuidedBrew'))
const TasteAnalysis = lazy(() => import('./pages/TasteAnalysis'))
const Analytics    = lazy(() => import('./pages/Analytics'))
const Recipes      = lazy(() => import('./pages/Recipes'))
const Settings     = lazy(() => import('./pages/Settings'))

function ProtectedRoute({ children }) {
  const { user, loading } = useApp()
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
      <div className="loading-brew-icon">
        <span className="material-symbols-outlined text-primary" style={{fontSize:'52px', fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 48"}}>coffee</span>
      </div>
      <p className="font-headline text-xl text-primary font-bold mt-2">Artisanal Brew</p>
      <div className="flex gap-1.5">
        <span className="loading-brew-dot" style={{animationDelay:'0ms'}}></span>
        <span className="loading-brew-dot" style={{animationDelay:'180ms'}}></span>
        <span className="loading-brew-dot" style={{animationDelay:'360ms'}}></span>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
