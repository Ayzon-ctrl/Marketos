import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ProtectedAppShell from './components/ProtectedAppShell'
import PublicAboutPage from './components/public/PublicAboutPage'
import PublicContactPage from './components/public/PublicContactPage'
import PublicImprintPage from './components/public/PublicImprintPage'
import PublicLandingPage from './components/public/PublicLandingPage'
import PublicLayout from './components/public/PublicLayout'
import PublicMarketDetailPage from './components/public/PublicMarketDetailPage'
import PublicMarketsPage from './components/public/PublicMarketsPage'
import PublicTermsPage from './components/public/PublicTermsPage'
import PublicVendorDetailPage from './components/public/PublicVendorDetailPage'
import PublicVendorsPage from './components/public/PublicVendorsPage'
import PublicWithdrawalPage from './components/public/PublicWithdrawalPage'
import LoginView from './components/views/LoginView'
import { supabase } from './supabaseClient'

function AuthLoadingScreen() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">M</div>
        <h1>MarketOS lädt</h1>
        <p className="muted">Wir prüfen gerade deine Sitzung und bauen die passende Ansicht auf.</p>
      </div>
    </div>
  )
}

function LoginRoute({ session }) {
  const location = useLocation()
  const nextPath = location.state?.from || '/app'

  if (session) return <Navigate to={nextPath} replace />
  return <LoginView />
}

function ProtectedRoute({ session, authReady, children }) {
  const location = useLocation()

  if (!authReady) return <AuthLoadingScreen />
  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  return children
}

function AppRoutes({ authReady, session }) {
  if (!authReady) return <AuthLoadingScreen />

  return (
    <Routes>
      <Route element={<PublicLayout session={session} />}>
        <Route element={<PublicLandingPage />} path="/" />
        <Route element={<PublicMarketsPage />} path="/markets" />
        <Route element={<PublicMarketDetailPage />} path="/markets/:eventId" />
        <Route element={<PublicVendorsPage />} path="/vendors" />
        <Route element={<PublicVendorDetailPage />} path="/vendors/:vendorId" />
        <Route element={<PublicAboutPage />} path="/about" />
        <Route element={<PublicContactPage />} path="/contact" />
        <Route element={<PublicImprintPage />} path="/imprint" />
        <Route element={<PublicTermsPage />} path="/terms" />
        <Route element={<PublicWithdrawalPage />} path="/withdrawal" />
      </Route>

      <Route element={<LoginRoute session={session} />} path="/login" />

      <Route
        element={
          <ProtectedRoute authReady={authReady} session={session}>
            <ProtectedAppShell session={session} />
          </ProtectedRoute>
        }
        path="/app/*"
      />

      <Route element={<Navigate replace to={session ? '/app' : '/'} />} path="*" />
    </Routes>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let mounted = true

    async function syncSession() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      setAuthReady(true)
    }

    syncSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return (
    <BrowserRouter>
      <AppRoutes authReady={authReady} session={session} />
    </BrowserRouter>
  )
}
