import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

// ---------------------------------------------------------------------------
// Farblogik: relative Heatmap-Skala basierend auf Anteil am Maximum
// ---------------------------------------------------------------------------

const HEAT_LABELS = {
  'heat-none':   'Inaktiv',
  'heat-cold':   'Kalt',
  'heat-low':    'Wenig',
  'heat-medium': 'Mittel',
  'heat-high':   'Stark',
  'heat-hot':    'Sehr stark',
}

function getHeatClass(value, maxValue) {
  if (!maxValue || value === 0) return 'heat-none'
  const pct = Math.round((value / maxValue) * 100)
  if (pct <= 10) return 'heat-cold'
  if (pct <= 30) return 'heat-low'
  if (pct <= 60) return 'heat-medium'
  if (pct <= 85) return 'heat-high'
  return 'heat-hot'
}

// ---------------------------------------------------------------------------
// Teilkomponenten
// ---------------------------------------------------------------------------

function HeatBadge({ value, maxValue }) {
  const cls = getHeatClass(value, maxValue)
  return (
    <span
      className={`analytics-heat-badge ${cls}`}
      title={HEAT_LABELS[cls]}
    />
  )
}

function BarRow({ label, count, maxCount, dateLabel = false }) {
  const pct = maxCount ? Math.round((count / maxCount) * 100) : 0
  const heatClass = getHeatClass(count, maxCount)
  return (
    <div className="analytics-bar-row" data-testid="analytics-bar-row">
      <span className={`analytics-bar-label${dateLabel ? ' analytics-bar-label-date' : ''}`}>
        {label}
      </span>
      <div className="analytics-bar-track">
        <div className={`analytics-bar-fill ${heatClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="analytics-bar-count">{count.toLocaleString('de-DE')}</span>
      <HeatBadge value={count} maxValue={maxCount} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------

export default function AnalyticsView({ profile }) {
  // Guard: Analytics nur fuer App-Admins (profile.is_admin = true).
  // Nicht-Admins sehen einen Hinweis statt der Daten.
  if (!profile?.is_admin) {
    return (
      <div className="card" data-testid="analytics-no-access">
        <p className="muted">
          Analytics ist nur für Administratoren verfügbar.
        </p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Filter-State
  // ---------------------------------------------------------------------------
  const [days, setDays]             = useState(30)
  const [area, setArea]             = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [environment, setEnvironment] = useState('production')

  // ---------------------------------------------------------------------------
  // Daten-State
  // ---------------------------------------------------------------------------
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)

    supabase
      .rpc('get_analytics_summary', {
        p_days:         days,
        p_area:         area || null,
        p_role_context: roleFilter || null,
        p_environment:  environment,
      })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return
        if (rpcError) {
          setFetchError('Analytics-Daten konnten nicht geladen werden.')
          setRows([])
        } else {
          setRows(data || [])
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [days, area, roleFilter, environment])

  // ---------------------------------------------------------------------------
  // Aggregierte Werte (rein clientseitig berechnet)
  // ---------------------------------------------------------------------------

  const totalEvents = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.event_count), 0),
    [rows]
  )

  const activeDays = useMemo(() => {
    const unique = new Set(
      rows.map(r => (typeof r.day === 'string' ? r.day : r.day?.toISOString?.()?.slice(0, 10)))
    )
    return unique.size
  }, [rows])

  // Top Event (nach Gesamtanzahl über alle Tage)
  const eventTotals = useMemo(() => {
    const acc = {}
    for (const r of rows) {
      acc[r.event_name] = (acc[r.event_name] || 0) + Number(r.event_count)
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [rows])

  const topEventByName = eventTotals[0] || null
  const maxEventTotal  = eventTotals[0]?.[1] || 0

  // Top Bereich
  const areaTotals = useMemo(() => {
    const acc = {}
    for (const r of rows) {
      acc[r.area] = (acc[r.area] || 0) + Number(r.event_count)
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [rows])

  const topArea    = areaTotals[0] || null
  const maxAreaTotal = areaTotals[0]?.[1] || 0

  // Rollenverteilung
  const roleTotals = useMemo(() => {
    const acc = {}
    for (const r of rows) {
      const role = r.role_context || '(keine Rolle)'
      acc[role] = (acc[role] || 0) + Number(r.event_count)
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [rows])

  const maxRoleTotal = roleTotals[0]?.[1] || 0

  // Tagesverlauf (neueste 30 Tage, aufsteigend sortiert)
  const dailyTotals = useMemo(() => {
    const acc = {}
    for (const r of rows) {
      const day = typeof r.day === 'string' ? r.day : r.day?.toISOString?.()?.slice(0, 10)
      if (day) acc[day] = (acc[day] || 0) + Number(r.event_count)
    }
    return Object.entries(acc)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
  }, [rows])

  const maxDayTotal = useMemo(
    () => Math.max(...dailyTotals.map(([, c]) => c), 0),
    [dailyTotals]
  )

  // Import-Conversion
  const importConversion = useMemo(() => {
    const opened    = rows.filter(r => r.event_name === 'import_dialog_opened').reduce((s, r) => s + Number(r.event_count), 0)
    const completed = rows.filter(r => r.event_name === 'import_completed').reduce((s, r) => s + Number(r.event_count), 0)
    if (!opened) return null
    return { opened, completed, pct: Math.round((completed / opened) * 100) }
  }, [rows])

  const isEmpty = !loading && !fetchError && rows.length === 0

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="analytics-view" data-testid="analytics-view">
      <div>
        <h2 style={{ margin: '0 0 2px' }}>Analytics</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Nur aggregierte Daten · Keine personenbezogenen Informationen
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filter-Leiste                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="card analytics-filters" data-testid="analytics-filters">
        <div className="row analytics-filter-row">
          <div className="analytics-filter-field">
            <label className="small">Zeitraum</label>
            <select
              className="input"
              data-testid="filter-days"
              value={days}
              onChange={e => setDays(Number(e.target.value))}
            >
              <option value={7}>7 Tage</option>
              <option value={30}>30 Tage</option>
              <option value={90}>90 Tage</option>
              <option value={365}>365 Tage</option>
            </select>
          </div>

          <div className="analytics-filter-field">
            <label className="small">Rolle</label>
            <select
              className="input"
              data-testid="filter-role"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">Alle</option>
              <option value="organizer">Organizer</option>
              <option value="exhibitor">Exhibitor</option>
              <option value="visitor">Visitor</option>
            </select>
          </div>

          <div className="analytics-filter-field">
            <label className="small">Bereich</label>
            <select
              className="input"
              data-testid="filter-area"
              value={area}
              onChange={e => setArea(e.target.value)}
            >
              <option value="">Alle</option>
              <option value="dashboard">Dashboard</option>
              <option value="events">Events</option>
              <option value="participants">Teilnehmer</option>
              <option value="event-detail">Event-Detail</option>
              <option value="stand-pricing">Standflächen</option>
              <option value="exhibitor-info">Ausstellerinfos</option>
              <option value="import">Import</option>
            </select>
          </div>

          <div className="analytics-filter-field">
            <label className="small">Umgebung</label>
            <select
              className="input"
              data-testid="filter-environment"
              value={environment}
              onChange={e => setEnvironment(e.target.value)}
            >
              <option value="production">Production</option>
              <option value="development">Development</option>
            </select>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Lade- / Fehler- / Leerzustand                                        */}
      {/* ------------------------------------------------------------------ */}
      {loading && (
        <p className="notice" data-testid="analytics-loading">
          Lade Analytics-Daten…
        </p>
      )}

      {fetchError && !loading && (
        <p className="error" data-testid="analytics-error">
          {fetchError}
        </p>
      )}

      {isEmpty && (
        <div className="card" data-testid="analytics-empty">
          <p className="muted" style={{ margin: 0 }}>
            Noch keine Analytics-Daten für diesen Zeitraum.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Daten-Sektionen (nur sichtbar wenn rows vorhanden)                  */}
      {/* ------------------------------------------------------------------ */}
      {!loading && !fetchError && rows.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="analytics-summary-grid" data-testid="analytics-summary">
            <div className="card">
              <p className="small muted" style={{ margin: '0 0 4px' }}>Gesamt-Events</p>
              <strong data-testid="summary-total" style={{ fontSize: 24, display: 'block' }}>
                {totalEvents.toLocaleString('de-DE')}
              </strong>
            </div>

            <div className="card">
              <p className="small muted" style={{ margin: '0 0 4px' }}>Aktive Tage</p>
              <strong data-testid="summary-days" style={{ fontSize: 24, display: 'block' }}>
                {activeDays}
              </strong>
            </div>

            <div className="card">
              <p className="small muted" style={{ margin: '0 0 4px' }}>Häufigstes Event</p>
              <strong
                data-testid="summary-top-event"
                style={{ fontSize: 15, display: 'block', wordBreak: 'break-word' }}
              >
                {topEventByName?.[0] ?? '–'}
              </strong>
              {topEventByName && (
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {topEventByName[1].toLocaleString('de-DE')}×
                </p>
              )}
            </div>

            <div className="card">
              <p className="small muted" style={{ margin: '0 0 4px' }}>Aktivster Bereich</p>
              <strong
                data-testid="summary-top-area"
                style={{ fontSize: 15, display: 'block', wordBreak: 'break-word' }}
              >
                {topArea?.[0] ?? '–'}
              </strong>
              {topArea && (
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {topArea[1].toLocaleString('de-DE')}×
                </p>
              )}
            </div>

            {importConversion && (
              <div className="card">
                <p className="small muted" style={{ margin: '0 0 4px' }}>Import-Conversion</p>
                <strong data-testid="summary-import-conversion" style={{ fontSize: 24, display: 'block' }}>
                  {importConversion.pct}%
                </strong>
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {importConversion.completed} / {importConversion.opened} abgeschlossen
                </p>
              </div>
            )}
          </div>

          {/* Top Events */}
          <section className="card" data-testid="top-events-section">
            <h3 style={{ margin: '0 0 4px' }}>Top Events</h3>
            <p className="small muted" style={{ margin: '0 0 12px' }}>
              Häufigkeit nach Event-Typ im gewählten Zeitraum
            </p>
            <div className="analytics-bar-list">
              {eventTotals.slice(0, 12).map(([name, count]) => (
                <BarRow key={name} label={name} count={count} maxCount={maxEventTotal} />
              ))}
            </div>
          </section>

          {/* Nutzung nach Bereich */}
          <section className="card" data-testid="area-breakdown-section">
            <h3 style={{ margin: '0 0 4px' }}>Nutzung nach Bereich</h3>
            <p className="small muted" style={{ margin: '0 0 12px' }}>
              Anteil jedes App-Bereichs an der Gesamtnutzung
            </p>
            <div className="analytics-bar-list">
              {areaTotals.map(([areaName, count]) => (
                <BarRow key={areaName} label={areaName} count={count} maxCount={maxAreaTotal} />
              ))}
            </div>
          </section>

          {/* Nutzung nach Rolle */}
          <section className="card" data-testid="role-breakdown-section">
            <h3 style={{ margin: '0 0 4px' }}>Nutzung nach Rolle</h3>
            <p className="small muted" style={{ margin: '0 0 12px' }}>
              Welcher Rollenkontext dominiert im gewählten Zeitraum
            </p>
            <div className="analytics-bar-list">
              {roleTotals.map(([role, count]) => (
                <BarRow key={role} label={role} count={count} maxCount={maxRoleTotal} />
              ))}
            </div>
          </section>

          {/* Tagesverlauf */}
          {dailyTotals.length > 0 && (
            <section className="card" data-testid="daily-timeline-section">
              <h3 style={{ margin: '0 0 4px' }}>Tagesverlauf</h3>
              <p className="small muted" style={{ margin: '0 0 12px' }}>
                Aggregierte Events pro Tag (max. letzte 30 Tage)
              </p>
              <div className="analytics-bar-list">
                {dailyTotals.map(([day, count]) => (
                  <BarRow key={day} label={day} count={count} maxCount={maxDayTotal} dateLabel />
                ))}
              </div>
            </section>
          )}

          {/* Import-Auswertung */}
          {importConversion && (
            <section className="card" data-testid="import-conversion-section">
              <h3 style={{ margin: '0 0 12px' }}>Import-Auswertung</h3>
              <div className="analytics-bar-list">
                <div className="analytics-bar-row">
                  <span className="analytics-bar-label">Dialog geöffnet</span>
                  <div className="analytics-bar-track">
                    <div className="analytics-bar-fill heat-cold" style={{ width: '100%' }} />
                  </div>
                  <span className="analytics-bar-count">{importConversion.opened}</span>
                  <span className="analytics-heat-badge heat-cold" />
                </div>
                <div className="analytics-bar-row">
                  <span className="analytics-bar-label">Import abgeschlossen</span>
                  <div className="analytics-bar-track">
                    <div
                      className={`analytics-bar-fill ${getHeatClass(importConversion.completed, importConversion.opened)}`}
                      style={{ width: `${importConversion.pct}%` }}
                    />
                  </div>
                  <span className="analytics-bar-count">{importConversion.completed}</span>
                  <span className={`analytics-heat-badge ${getHeatClass(importConversion.completed, importConversion.opened)}`} />
                </div>
                <div className="analytics-bar-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
                  <span className="analytics-bar-label" style={{ fontWeight: 900 }}>Conversion</span>
                  <div className="analytics-bar-track" />
                  <strong className="analytics-bar-count">{importConversion.pct}%</strong>
                  <span className="analytics-heat-badge" />
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
