import { useCallback, useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { getAuthErrorMessage, getUserErrorMessage } from '../../lib/userError'

const ROLE_LABELS = {
  organizer: 'Veranstalter',
  exhibitor: 'Aussteller',
  both: 'Veranstalter & Aussteller',
}

/**
 * Konto-Seite (/app/account)
 *
 * Erlaubt das Bearbeiten von:
 *   display_name, first_name, last_name, company_name
 *
 * Nicht editierbar (read-only oder verborgen):
 *   email  – kommt aus session.user.email (auth.users, nicht profiles)
 *   role   – nur anzeigen, kein Formularfeld
 *   is_admin – nur anzeigen wenn true, kein Formularfeld
 *   id, created_at – nie im Payload
 *
 * Sicherheit: Das Update-Payload enthält bewusst KEINE Felder für
 *   role oder is_admin. Die bestehende RLS-Policy profiles_update_own
 *   erlaubt es einem User, sein eigenes Profil zu aktualisieren, enthält
 *   aber keinen Column-Level-Schutz für is_admin. Daher wird is_admin
 *   hier strikt aus dem Payload ausgeschlossen (kein Exploit-Risiko
 *   durch diese View, aber das grundlegende DB-Risiko bleibt bekannt –
 *   Fix folgt separat als DB-Migration mit BEFORE UPDATE Trigger).
 */
const MIN_PASSWORD_LENGTH = 6

export default function AccountView({ profile, session, notify, onProfileUpdated }) {
  const [form, setForm] = useState({
    display_name: '',
    first_name: '',
    last_name: '',
    company_name: '',
  })
  const [saving, setSaving] = useState(false)

  // Passwort-Änderung
  const [pwForm, setPwForm] = useState({ newPassword: '', confirmPassword: '' })
  const [pwError, setPwError] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // E-Mail-Änderung
  const [emailForm, setEmailForm] = useState({ newEmail: '' })
  const [emailError, setEmailError] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  const handlePwChange = useCallback(e => {
    const { name, value } = e.target
    setPwForm(prev => ({ ...prev, [name]: value }))
    setPwError('') // Fehler beim Tippen zurücksetzen
  }, [])

  const handleEmailChange = useCallback(e => {
    setEmailForm(prev => ({ ...prev, newEmail: e.target.value }))
    setEmailError('') // Fehler beim Tippen zurücksetzen
  }, [])

  const handlePasswordSave = useCallback(async e => {
    e.preventDefault()
    setPwError('')

    const { newPassword, confirmPassword } = pwForm

    if (!newPassword || !confirmPassword) {
      setPwError('Bitte beide Felder ausfüllen.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPwError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Die Passwörter stimmen nicht überein.')
      return
    }

    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwForm({ newPassword: '', confirmPassword: '' })
      notify('success', 'Passwort wurde geändert.')
    } catch (err) {
      setPwError(getAuthErrorMessage(err, 'Passwort konnte nicht geändert werden.'))
    } finally {
      setSavingPw(false)
    }
  }, [notify, pwForm])

  const handleEmailSave = useCallback(async e => {
    e.preventDefault()
    setEmailError('')

    const newEmail = emailForm.newEmail.trim()

    if (!newEmail) {
      setEmailError('Bitte gib eine neue E-Mail-Adresse ein.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('Bitte gib eine gültige E-Mail-Adresse ein.')
      return
    }
    if (newEmail.toLowerCase() === (session?.user?.email || '').toLowerCase()) {
      setEmailError('Die neue E-Mail-Adresse entspricht der aktuellen.')
      return
    }

    setSavingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/app/account` }
      )
      if (error) throw error
      setEmailForm({ newEmail: '' })
      notify('success', 'Bestätigungsmail wurde gesendet. Bitte bestätige die neue Adresse.')
    } catch (err) {
      setEmailError(getAuthErrorMessage(err, 'E-Mail konnte nicht geändert werden.'))
    } finally {
      setSavingEmail(false)
    }
  }, [emailForm.newEmail, notify, session])

  // Formular mit Profildaten befüllen wenn sich profile ändert
  useEffect(() => {
    if (!profile) return
    setForm({
      display_name: profile.display_name || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      company_name: profile.company_name || '',
    })
  }, [profile])

  const handleChange = useCallback(e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleSave = useCallback(async e => {
    e.preventDefault()
    if (!profile?.id || saving) return

    setSaving(true)
    try {
      // Explizit nur erlaubte Felder senden.
      // role, is_admin, id, created_at werden bewusst NICHT mitgesendet.
      const payload = {
        display_name: form.display_name.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        company_name: form.company_name.trim(),
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', profile.id)
        .select()
        .single()

      if (error) throw error

      onProfileUpdated?.(data)
      notify('success', 'Profil gespeichert.')
    } catch (err) {
      notify('error', getUserErrorMessage(err, 'Profil konnte nicht gespeichert werden.'))
    } finally {
      setSaving(false)
    }
  }, [form, notify, onProfileUpdated, profile, saving])

  const email = session?.user?.email || '–'
  const roleLabel = ROLE_LABELS[profile?.role] ?? profile?.role ?? '–'
  const isAdmin = profile?.is_admin === true

  return (
    <div className="view-section" data-testid="account-view">
      <h2>Konto</h2>

      {/* ------------------------------------------------------------------ */}
      {/* Abschnitt: Profil                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" data-testid="account-profile-section">
        <h3>Profil</h3>
        <form data-testid="account-profile-form" onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="account-display-name">Anzeigename</label>
            <input
              id="account-display-name"
              name="display_name"
              className="input"
              data-testid="account-display-name"
              placeholder="z. B. Edwin"
              value={form.display_name}
              onChange={handleChange}
            />
            <small className="muted">Erscheint oben in der Begrüßung.</small>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="account-first-name">Vorname</label>
              <input
                id="account-first-name"
                name="first_name"
                className="input"
                data-testid="account-first-name"
                value={form.first_name}
                onChange={handleChange}
              />
            </div>
            <div className="field">
              <label htmlFor="account-last-name">Nachname</label>
              <input
                id="account-last-name"
                name="last_name"
                className="input"
                data-testid="account-last-name"
                value={form.last_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="account-company-name">Firma / Marke</label>
            <input
              id="account-company-name"
              name="company_name"
              className="input"
              data-testid="account-company-name"
              value={form.company_name}
              onChange={handleChange}
            />
          </div>

          <button
            className="btn"
            type="submit"
            data-testid="account-save"
            disabled={saving}
          >
            {saving ? 'Speichert...' : 'Profil speichern'}
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Abschnitt: Konto-Info (read-only)                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" data-testid="account-info-section">
        <h3>Konto</h3>

        <div className="field">
          <label>E-Mail</label>
          <p className="muted" data-testid="account-email">{email}</p>
          <small className="muted">E-Mail-Adresse kann im Bereich „Sicherheit" geändert werden.</small>
        </div>

        <div className="field">
          <label>Rolle</label>
          <p data-testid="account-role">{roleLabel}</p>
          <small className="muted">Rollen-Erweiterung folgt in einer späteren Version.</small>
        </div>

        {isAdmin && (
          <div className="field">
            <label>Status</label>
            <p data-testid="account-admin-badge">
              <span className="pill">Admin</span>
            </p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Abschnitt: Sicherheit – Passwort ändern                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" data-testid="account-security-section">
        <h3>Sicherheit</h3>
        <form data-testid="account-password-form" onSubmit={handlePasswordSave}>
          <p className="small muted" style={{ marginBottom: '12px' }}>Passwort ändern</p>

          <div className="field">
            <label htmlFor="account-new-password">Neues Passwort</label>
            <input
              id="account-new-password"
              name="newPassword"
              type="password"
              className="input"
              data-testid="account-new-password"
              autoComplete="new-password"
              value={pwForm.newPassword}
              onChange={handlePwChange}
            />
          </div>

          <div className="field">
            <label htmlFor="account-confirm-password">Passwort wiederholen</label>
            <input
              id="account-confirm-password"
              name="confirmPassword"
              type="password"
              className="input"
              data-testid="account-confirm-password"
              autoComplete="new-password"
              value={pwForm.confirmPassword}
              onChange={handlePwChange}
            />
          </div>

          {pwError && (
            <p className="error small" data-testid="account-password-error" style={{ marginBottom: '8px' }}>
              {pwError}
            </p>
          )}

          <button
            className="btn"
            type="submit"
            data-testid="account-password-save"
            disabled={savingPw}
          >
            {savingPw ? 'Wird geändert...' : 'Passwort ändern'}
          </button>
        </form>

        <form
          data-testid="account-email-form"
          onSubmit={handleEmailSave}
          noValidate
          style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,.08)' }}
        >
          <p className="small muted" style={{ marginBottom: '12px' }}>E-Mail ändern</p>

          <div className="field">
            <label>Aktuelle E-Mail</label>
            <p className="muted" data-testid="account-current-email-display">{email}</p>
          </div>

          <div className="field">
            <label htmlFor="account-new-email">Neue E-Mail-Adresse</label>
            <input
              id="account-new-email"
              name="newEmail"
              type="email"
              className="input"
              data-testid="account-new-email"
              autoComplete="email"
              value={emailForm.newEmail}
              onChange={handleEmailChange}
            />
            <small className="muted">
              Du erhältst eine Bestätigungsmail an die neue Adresse. Die Änderung wird erst nach Bestätigung aktiv.
            </small>
          </div>

          {emailError && (
            <p className="error small" data-testid="account-email-error" style={{ marginBottom: '8px' }}>
              {emailError}
            </p>
          )}

          <button
            className="btn"
            type="submit"
            data-testid="account-email-save"
            disabled={savingEmail}
          >
            {savingEmail ? 'Wird gesendet...' : 'E-Mail ändern'}
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Abschnitt: Sitzung / Logout                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="card" data-testid="account-session-section">
        <h3>Sitzung</h3>
        <p className="muted">
          Du bist als <strong data-testid="account-session-email">{email}</strong> angemeldet.
        </p>
        <button
          className="btn danger-outline"
          type="button"
          data-testid="account-logout-button"
          onClick={() => supabase.auth.signOut()}
        >
          <LogOut size={16} /> Abmelden
        </button>
      </section>
    </div>
  )
}
