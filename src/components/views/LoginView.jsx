import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { getUserErrorMessage } from '../../lib/userError'

export default function LoginView() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('organizer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
        if (loginError) throw loginError
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              company_name: companyName,
              role
            }
          }
        })

        if (signUpError) throw signUpError

        setMessage(
          'Registrierung erstellt. Falls E-Mail-Bestätigung aktiv ist, bitte Mail prüfen. Ja, auch Spam, weil E-Mail-Systeme gern Theater machen.'
        )
      }
    } catch (err) {
      setError(
        getUserErrorMessage(
          err,
          mode === 'login' ? 'Anmeldung fehlgeschlagen.' : 'Registrierung fehlgeschlagen.'
        )
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" data-testid="login-form" onSubmit={submit}>
        <div className="logo">M</div>
        <h1>{mode === 'login' ? 'Einloggen' : 'Kostenlos starten'}</h1>
        <p className="muted">MarketOS V1 mit Supabase Login. Noch klein, aber immerhin kein Excel-Zombie.</p>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        {mode === 'register' && (
          <>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="register-first-name">Vorname</label>
                <input
                  id="register-first-name"
                  data-testid="register-first-name"
                  className="input"
                  value={firstName}
                  onChange={event => setFirstName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="register-last-name">Nachname</label>
                <input
                  id="register-last-name"
                  data-testid="register-last-name"
                  className="input"
                  value={lastName}
                  onChange={event => setLastName(event.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="register-company-name">Firma / Marke</label>
              <input
                id="register-company-name"
                data-testid="register-company-name"
                className="input"
                value={companyName}
                onChange={event => setCompanyName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="register-role">Rolle</label>
              <select
                id="register-role"
                data-testid="register-role"
                value={role}
                onChange={event => setRole(event.target.value)}
              >
                <option value="organizer">Veranstalter</option>
                <option value="exhibitor">Aussteller</option>
                <option value="both">Beides</option>
              </select>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="login-email">E-Mail</label>
          <input
            id="login-email"
            data-testid="login-email"
            className="input"
            type="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Passwort</label>
          <div className="password-field">
            <input
              id="login-password"
              data-testid="login-password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              minLength="6"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            <button
              className="icon-btn password-toggle-btn"
              type="button"
              aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              data-testid="toggle-password"
              onClick={() => setShowPassword(current => !current)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          className="btn"
          data-testid={mode === 'login' ? 'login-submit' : 'register-submit'}
          disabled={loading}
        >
          {loading ? 'Lädt...' : mode === 'login' ? 'Einloggen' : 'Registrieren'}
        </button>

        <div className="divider" />
        <button
          type="button"
          className="btn ghost"
          onClick={() => setMode(current => (current === 'login' ? 'register' : 'login'))}
        >
          {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon Konto? Einloggen'}
        </button>
      </form>
    </div>
  )
}
