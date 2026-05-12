import { useMemo } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import {
  addDaysToDateKey,
  fmtDate,
  getLocalDateKey,
  isDateWithinRange
} from '../../lib/eventUtils'
import {
  getParticipantStatusClass,
  getParticipantStatusLabel,
  getParticipantStatusSummary,
  participantStatusOptions
} from '../../lib/participantUtils'
import Stat from '../Stat'

export default function ExhibitorOverviewView({
  stats = [],
  vendorProfile = null,
  exhibitorEvents = [],
  exhibitorParticipants = [],
  exhibitorAnnouncements = [],
  openParticipantsView,
  profileName
}) {
  const safeStats = stats ?? []
  const participantSummary = useMemo(
    () => getParticipantStatusSummary(exhibitorParticipants),
    [exhibitorParticipants]
  )
  const eventById = useMemo(
    () => new Map((exhibitorEvents || []).map(event => [event.id, event])),
    [exhibitorEvents]
  )
  const todayKey = useMemo(() => getLocalDateKey(), [])
  const weekEndKey = useMemo(() => addDaysToDateKey(todayKey, 6), [todayKey])
  const upcomingParticipations = useMemo(
    () =>
      exhibitorParticipants
        .map(participant => ({
          participant,
          event: eventById.get(participant.event_id)
        }))
        .filter(item => item.event)
        .sort((a, b) => String(a.event.event_date || '').localeCompare(String(b.event.event_date || '')))
        .slice(0, 5),
    [eventById, exhibitorParticipants]
  )
  const todayParticipations = useMemo(
    () => upcomingParticipations.filter(item => item.event.event_date === todayKey).slice(0, 4),
    [todayKey, upcomingParticipations]
  )
  const weekParticipations = useMemo(
    () =>
      upcomingParticipations
        .filter(
          item =>
            item.event.event_date &&
            item.event.event_date > todayKey &&
            isDateWithinRange(item.event.event_date, todayKey, weekEndKey)
        )
        .slice(0, 4),
    [todayKey, upcomingParticipations, weekEndKey]
  )
  const announcementCount = (exhibitorAnnouncements || []).length
  const importantTodosCount = participantSummary.offen + participantSummary.warteliste + announcementCount
  const nextEventInfo = useMemo(() => {
    const next = upcomingParticipations.find(item => item.event.event_date && item.event.event_date >= todayKey)
    if (!next) return null
    const diffMs = new Date(`${next.event.event_date}T12:00:00`).getTime() - new Date(`${todayKey}T12:00:00`).getTime()
    return {
      ...next,
      days: Math.round(diffMs / 86400000)
    }
  }, [todayKey, upcomingParticipations])
  const lastPastEventInfo = useMemo(() => {
    const past = [...upcomingParticipations]
      .filter(item => item.event.event_date && item.event.event_date < todayKey)
      .sort((a, b) => String(b.event.event_date || '').localeCompare(String(a.event.event_date || '')))
      .at(0)

    if (!past) return null
    const diffMs = new Date(`${todayKey}T12:00:00`).getTime() - new Date(`${past.event.event_date}T12:00:00`).getTime()
    return {
      ...past,
      days: Math.round(diffMs / 86400000)
    }
  }, [todayKey, upcomingParticipations])
  const showEmptyState =
    !vendorProfile &&
    exhibitorEvents.length === 0 &&
    exhibitorParticipants.length === 0 &&
    exhibitorAnnouncements.length === 0

  return (
    <div className="grid">
      {showEmptyState && (
        <div className="card" data-testid="exhibitor-empty-state">
          <strong>Noch kein Ausstellerprofil vorhanden.</strong>
          <p className="muted">Für diese Ansicht sind noch keine Ausstellerdaten hinterlegt.</p>
        </div>
      )}

      <div className="card summary-hero" data-testid="exhibitor-summary-hero">
        <strong>Hallo {profileName}</strong>
        <p className="muted">
          Du hast heute {importantTodosCount} wichtige ToDos.{` `}
          {nextEventInfo
            ? `Dein nächstes Event ${nextEventInfo.event.title || 'Ohne Eventname'} ist ${nextEventInfo.days === 0 ? 'heute' : `in ${nextEventInfo.days} Tagen`} und aktuell ${nextEventInfo.participant.paid ? 'bezahlt' : 'noch offen'}.`
            : 'Aktuell ist kein nächstes Event hinterlegt.'}{` `}
          {lastPastEventInfo
            ? `Dein letztes Event war vor ${lastPastEventInfo.days} Tagen. Bewertungen und weitere Zusatzbereiche findest du gesammelt im Bereich Mehr.`
            : 'Bewertungen und weitere Zusatzbereiche findest du gesammelt im Bereich Mehr.'}
        </p>
        <div className="summary-hero-actions">
          <button
            className="btn secondary"
            data-testid="exhibitor-summary-open-participants"
            type="button"
            onClick={() => openParticipantsView?.('offen')}
          >
            Wichtige ToDos ansehen
          </button>
        </div>
      </div>

      <div className="grid stats">{safeStats.map(stat => <Stat key={stat.label} {...stat} />)}</div>

      <div className="grid two">
        <div className="card timeline-card" data-testid="exhibitor-today-panel">
          <div className="timeline-header">
            <div>
              <h2 className="section-title">Heute für mich</h2>
              <p className="muted">Was heute rund um deine Teilnahme wirklich zählt.</p>
            </div>
            <span className="pill info-pill">{fmtDate(todayKey)}</span>
          </div>

          <div className="timeline-section timeline-section-participants">
            <strong>Teilnahmen heute</strong>
            <div className="list compact">
              {todayParticipations.length === 0 && (
                <p className="muted">Heute ist keine Teilnahme eingetragen.</p>
              )}
              {todayParticipations.map(({ participant, event }) => (
                <button
                  className="item action-list-item"
                  data-testid="exhibitor-today-event"
                  key={participant.id}
                  type="button"
                  onClick={() => openParticipantsView?.('alle', event.id)}
                >
                  <strong>{event.title || 'Ohne Eventname'}</strong>
                  <p className="muted">{participant.exhibitor_name || 'Ohne Namen'} · {event.location || 'Ort offen'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="timeline-section timeline-section-todos">
            <strong>Was heute offen ist</strong>
            <div className="list compact">
              {participantSummary.offen === 0 && announcementCount === 0 && (
                <p className="muted">Heute ist aktuell nichts offen oder kritisch.</p>
              )}
              {participantSummary.offen > 0 && (
                <button
                  className="item action-list-item"
                  data-testid="exhibitor-today-open-payments"
                  type="button"
                  onClick={() => openParticipantsView?.('offen')}
                >
                  <strong>Offene Zahlungen</strong>
                  <p className="muted">{participantSummary.offen} Teilnahme(n) brauchen noch Klärung.</p>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card timeline-card" data-testid="exhibitor-week-panel">
          <div className="timeline-header">
            <div>
              <h2 className="section-title">Diese Woche</h2>
              <p className="muted">Damit du weißt, was in den nächsten Tagen vor dir liegt.</p>
            </div>
            <span className="pill info-pill">{fmtDate(weekEndKey)}</span>
          </div>

          <div className="timeline-section timeline-section-participants">
            <strong>Nächste Teilnahmen</strong>
            <div className="list compact">
              {weekParticipations.length === 0 && (
                <p className="muted">Diese Woche stehen keine weiteren Teilnahmen an.</p>
              )}
              {weekParticipations.map(({ participant, event }) => (
                <button
                  className="item action-list-item"
                  data-testid="exhibitor-week-event"
                  key={participant.id}
                  type="button"
                  onClick={() => openParticipantsView?.('alle', event.id)}
                >
                  <strong>{event.title || 'Ohne Eventname'}</strong>
                  <p className="muted">{fmtDate(event.event_date)} · Stand {participant.booth || '-'}</p>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      <div className="grid two">
        <div className="card" data-testid="exhibitor-next-events">
          <h2 className="section-title">Meine nächsten Teilnahmen</h2>
          <p className="muted">Für Aussteller zählt: Wann, wo, bezahlt oder noch offen.</p>
          <div className="event-card-list">
            {upcomingParticipations.length === 0 && (
              <p className="muted">Noch keine Teilnahmen hinterlegt. Das wird hier dein eigentlicher Arbeitsbereich.</p>
            )}
            {upcomingParticipations.map(({ participant, event }) => (
              <article className="event-card" data-testid="exhibitor-event-card" key={participant.id}>
                <div className="event-card-header">
                  <h3>{event.title || 'Ohne Eventname'}</h3>
                  <span className={getParticipantStatusClass(participant.status)}>
                    {getParticipantStatusLabel(participant.status)}
                  </span>
                </div>
                <p><CalendarDays size={16} /> {fmtDate(event.event_date)}</p>
                <p><MapPin size={16} /> {event.location || 'Stadt offen'}</p>
                <p className="muted">{participant.exhibitor_name || 'Ohne Namen'}</p>
                <p className="muted">Stand {participant.booth || '-'} · {participant.paid ? 'Bezahlt' : 'Offen'}</p>
                <div className="event-card-actions">
                  <button
                    className="btn secondary"
                    data-testid="exhibitor-open-participation"
                    type="button"
                    onClick={() => openParticipantsView?.('alle', event.id)}
                  >
                    Teilnahme öffnen
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="card action-center-card" data-testid="exhibitor-action-center">
          <h2 className="section-title">Mein Fokus</h2>
          <p className="muted">Was du als Aussteller als Nächstes erledigen solltest.</p>
          <div className="action-center-list">
            <button
              className="action-center-item"
              data-testid="exhibitor-action-payments"
              type="button"
              onClick={() => openParticipantsView?.('offen')}
            >
              <div>
                <strong>Offene Zahlungen</strong>
                <p className="muted">
                  {participantSummary.offen > 0
                    ? `${participantSummary.offen} Teilnahme(n) brauchen noch Klärung`
                    : 'Alles bezahlt oder bestätigt'}
                </p>
              </div>
              <span className={`pill ${participantSummary.offen > 0 ? 'status-payment-open' : 'info-pill'}`}>
                {participantSummary.offen}
              </span>
            </button>

            <button
              className="action-center-item"
              data-testid="exhibitor-action-waitlist"
              type="button"
              onClick={() => openParticipantsView?.('warteliste')}
            >
              <div>
                <strong>Warteliste</strong>
                <p className="muted">
                  {participantSummary.warteliste > 0
                    ? `${participantSummary.warteliste} Anmeldung(en) warten auf Rückmeldung`
                    : 'Keine Wartelisten im Moment'}
                </p>
              </div>
              <span className={`pill ${participantSummary.warteliste > 0 ? 'status-participant-waitlist' : 'info-pill'}`}>
                {participantSummary.warteliste}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div>
        <div
          className="card participant-overview-card module-participants-panel"
          data-testid="exhibitor-participant-status"
        >
          <h2>Mein Status</h2>
          <p className="muted">Direkt filtern, statt sich durch Märkte zu klicken.</p>
          <div className="participant-summary-grid">
            {participantStatusOptions.map(([value, label]) => (
              <button
                className="participant-summary-item clickable-summary"
                data-testid={`exhibitor-participant-summary-${value}`}
                type="button"
                key={value}
                onClick={() => openParticipantsView?.(value)}
              >
                <span className={getParticipantStatusClass(value)}>{label}</span>
                <strong>{participantSummary[value]}</strong>
              </button>
            ))}
            <button
              className="participant-summary-item clickable-summary"
              data-testid="exhibitor-participant-summary-bezahlt"
              type="button"
              onClick={() => openParticipantsView?.('bezahlt')}
            >
              <span className="pill status-payment-paid">Bezahlt</span>
              <strong>{participantSummary.bezahlt}</strong>
            </button>
            <button
              className="participant-summary-item clickable-summary"
              data-testid="exhibitor-participant-summary-offen"
              type="button"
              onClick={() => openParticipantsView?.('offen')}
            >
              <span className="pill status-payment-open">Offen</span>
              <strong>{participantSummary.offen}</strong>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
