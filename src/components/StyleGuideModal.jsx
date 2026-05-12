export default function StyleGuideModal({
  backgroundThemes,
  busy = false,
  onboardingMode = false,
  onClose,
  onSave,
  onThemeChange,
  open,
  sidebarThemes,
  themePrefs
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" data-testid="style-guide-modal">
      <div
        className="modal-card style-guide-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="style-guide-title"
      >
        <div className="style-guide-modal-header">
          <div>
            <h3 id="style-guide-title">Style Guide</h3>
            <p className="muted">
              Wähle eine ruhige Kombination für Seitenleiste und Hintergrund. Deine Auswahl wird
              direkt angewendet.
            </p>
          </div>
          {!onboardingMode && (
            <button
              className="btn ghost"
              data-testid="style-guide-close"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Schließen
            </button>
          )}
        </div>

        <div className="theme-group">
          <span className="small">Seitenleiste</span>
          <div className="theme-swatch-row">
            {sidebarThemes.map(theme => (
              <button
                key={theme.id}
                aria-label={`Seitenleiste ${theme.label}`}
                className={`theme-swatch ${themePrefs.sidebarTheme === theme.id ? 'active' : ''}`}
                data-testid={`theme-sidebar-${theme.id}`}
                onClick={() => onThemeChange({ sidebarTheme: theme.id })}
                style={{ background: theme.sidebar }}
                type="button"
              />
            ))}
          </div>
        </div>

        <div className="theme-group">
          <span className="small">Hintergrund</span>
          <div className="theme-swatch-row">
            {backgroundThemes.map(theme => (
              <button
                key={theme.id}
                aria-label={`Hintergrund ${theme.label}`}
                className={`theme-swatch light ${themePrefs.backgroundTheme === theme.id ? 'active' : ''}`}
                data-testid={`theme-background-${theme.id}`}
                onClick={() => onThemeChange({ backgroundTheme: theme.id })}
                style={{ background: theme.background }}
                type="button"
              />
            ))}
          </div>
        </div>

        <div className="style-guide-modal-footer">
          {onboardingMode ? (
            <button
              className="btn"
              data-testid="style-guide-save"
              disabled={busy}
              onClick={onSave}
              type="button"
            >
              {busy ? 'Speichert...' : 'Verstanden und speichern'}
            </button>
          ) : (
            <p className="muted small">
              Über die Seitenleiste kannst du den Style Guide jederzeit wieder öffnen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
