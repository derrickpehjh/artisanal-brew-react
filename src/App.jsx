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

function ProtectedRoute({ children }) {
  const { user, loading } = useApp()
  if (loading) return <div className="flex items-center justify-center h-screen bg-background"><div className="font-headline text-primary text-2xl">Loading…</div></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
