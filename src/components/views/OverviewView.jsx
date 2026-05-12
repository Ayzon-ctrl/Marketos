import { useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import {
  addDaysToDateKey,
  fmtDate,
  getLocalDateKey,
  isDateWithinRange
} from '../../lib/eventUtils'
import {
  getTaskPriorityClass,
  getTaskPriorityLabel,
  getTaskScopeLabel
} from '../../lib/taskUtils'
import { getUserErrorMessage } from '../../lib/userError'
import ConfirmModal from '../ConfirmModal'
import EventCard from '../EventCard'
import ExhibitorOverviewView from './ExhibitorOverviewView'

export default function OverviewView({
  events,
  participants,
  tasks,
  announcements,
  templates,
  reviews,
  reload,
  notify,
  eventIssues,
  openEventDetail,
  openParticipantsView,
  openView,
  roleView,
  profileName,
  stats,
  vendorProfile,
  exhibitorEvents,
  exhibitorParticipants,
  exhibitorAnnouncements
}) {
  if (roleView === 'exhibitor') {
    return (
      <ExhibitorOverviewView
        stats={stats}
        vendorProfile={vendorProfile}
        exhibitorEvents={exhibitorEvents}
        exhibitorParticipants={exhibitorParticipants}
        exhibitorAnnouncements={exhibitorAnnouncements}
        openParticipantsView={openParticipantsView}
        profileName={profileName}
      />
    )
  }

  const participantSummary = useMemo(() => {
    const safeParticipants = participants || []

    return {
      angefragt: safeParticipants.filter(
        participant => (participant.status || 'angefragt') === 'angefragt'
      ).length,
      bestaetigt: safeParticipants.filter(
        participant => (participant.status || (participant.paid ? 'bestaetigt' : 'angefragt')) === 'bestaetigt'
      ).length,
      warteliste: safeParticipants.filter(participant => participant.status === 'warteliste').length,
      offen: safeParticipants.filter(participant => !participant.paid).length
    }
  }, [participants])

  const todayKey = useMemo(() => getLocalDateKey(), [])
  const weekEndKey = useMemo(() => addDaysToDateKey(todayKey, 6), [todayKey])
  const openTasks = useMemo(() => tasks.filter(task => !task.done), [tasks])
  const todayEvents = useMemo(
    () => events.filter(event => event.event_date === todayKey).slice(0, 4),
    [events, todayKey]
  )
  const thisWeekEvents = useMemo(
    () =>
      events
        .filter(
          event =>
            event.event_date &&
            event.event_date > todayKey &&
            isDateWithinRange(event.event_date, todayKey, weekEndKey)
        )
        .slice(0, 4),
    [events, todayKey, weekEndKey]
  )
  const todayTasks = useMemo(
    () => openTasks.filter(task => task.due_date === todayKey).slice(0, 4),
    [openTasks, todayKey]
  )
  const thisWeekTasks = useMemo(
    () =>
      openTasks
        .filter(
          task =>
            task.due_date &&
            task.due_date > todayKey &&
            isDateWithinRange(task.due_date, todayKey, weekEndKey)
        )
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
        .slice(0, 4),
    [openTasks, todayKey, weekEndKey]
  )
  const pendingParticipants = useMemo(
    () =>
      participants
        .filter(participant => (participant.status || 'angefragt') === 'angefragt')
        .map(participant => ({
          ...participant,
          eventTitle:
            events.find(event => event.id === participant.event_id)?.title || 'Ohne Event'
        }))
        .slice(0, 4),
    [events, participants]
  )
  const unpublishedEvents = useMemo(
    () => events.filter(event => !event.public_visible).slice(0, 4),
    [events]
  )
  const focusEvent = useMemo(() => events[0] || null, [events])
  const messageCount = announcements.length
  const hasCriticalItems = useMemo(
    () =>
      participantSummary.angefragt > 0 ||
      unpublishedEvents.length > 0 ||
      participantSummary.offen > 0 ||
      eventIssues.length > 0,
    [eventIssues.length, participantSummary.angefragt, participantSummary.offen, unpublishedEvents.length]
  )
  const kpiCards = useMemo(
    () => [
      {
        key: 'events',
        label: 'Aktive Events',
        value: events.length,
        note:
          unpublishedEvents.length > 0
            ? `${unpublishedEvents.length} noch intern`
            : 'Alle geplanten Events im Blick',
        actionLabel: unpublishedEvents.length > 0 ? 'Jetzt prüfen' : 'Events öffnen',
        onClick: () => openView?.('events')
      },
      {
        key: 'participants',
        label: 'Bestätigte Händler',
        value: participantSummary.bestaetigt,
        note:
          participantSummary.angefragt > 0
            ? `${participantSummary.angefragt} warten auf Entscheidung`
            : 'Keine offenen Bestätigungen',
        actionLabel: participantSummary.angefragt > 0 ? 'Teilnehmer prüfen' : 'Teilnehmer öffnen',
        onClick: () =>
          openParticipantsView?.(
            participantSummary.angefragt > 0 ? 'angefragt' : 'bestaetigt'
          )
      },
      {
        key: 'payments',
        label: 'Offene Zahlungen',
        value: participantSummary.offen,
        note:
          participantSummary.offen > 0
            ? 'Zahlungen brauchen Aufmerksamkeit'
            : 'Heute ist nichts offen',
        actionLabel: 'Zahlungen prüfen',
        onClick: () => openParticipantsView?.('offen')
      },
      {
        key: 'tasks',
        label: 'Offene ToDos',
        value: openTasks.length,
        note:
          openTasks.length > 0
            ? `${openTasks.length} Aufgabe${openTasks.length === 1 ? '' : 'n'} warten auf dich`
            : 'Heute ist nichts Dringendes offen',
        actionLabel: 'ToDos öffnen',
        onClick: () => openView?.('tasks')
      }
    ],
    [
      events.length,
      openTasks.length,
      openParticipantsView,
      openView,
      participantSummary.angefragt,
      participantSummary.bestaetigt,
      participantSummary.offen,
      unpublishedEvents.length
    ]
  )
  const [eventToDelete, setEventToDelete] = useState(null)
  const [deletingEvent, setDeletingEvent] = useState(false)

  async function confirmDeleteEvent() {
    if (!eventToDelete) return

    setDeletingEvent(true)
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventToDelete.id)
      if (error) throw error
      await reload()
      notify?.('success', 'Event gelöscht.')
      setEventToDelete(null)
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Event konnte nicht gelöscht werden.'))
    } finally {
      setDeletingEvent(false)
    }
  }

  return (
    <div className="grid">
      <section className="card overview-focus-card" data-testid="overview-focus-card">
        <div className="overview-focus-header">
          <div>
            <h2 className="section-title">Dein Tagesfokus</h2>
            <p className="muted">
              Die wichtigsten Entscheidungen zuerst, damit der Tag nicht in lauter gleich wichtigen Karten endet.
            </p>
          </div>
          <span className="pill info-pill">{fmtDate(todayKey)}</span>
        </div>
        {!hasCriticalItems && (
          <div className="notice" data-testid="overview-no-critical-items">
            Heute ist nichts Dringendes offen.
          </div>
        )}
      </section>

      <section className="card overview-section-card" data-testid="overview-critical-section">
        <div className="overview-section-header">
          <div>
            <h2 className="section-title">Kritisch / Aktion nötig</h2>
            <p className="muted">Nur das, was jetzt Aufmerksamkeit braucht.</p>
          </div>
        </div>
        <div className="overview-priority-grid">
          <button
            className="priority-action-card"
            data-testid="overview-critical-participants"
            type="button"
            onClick={() => openParticipantsView?.('angefragt')}
          >
            <div className="row space-between">
              <strong>Teilnehmerentscheidungen</strong>
              <span className={`pill ${participantSummary.angefragt > 0 ? 'status-participant-review' : 'info-pill'}`}>
                {participantSummary.angefragt}
              </span>
            </div>
            <p className="muted">
              {participantSummary.angefragt > 0
                ? `${participantSummary.angefragt} Teilnehmer warten auf deine Entscheidung.`
                : 'Keine offenen Teilnehmerentscheidungen.'}
            </p>
            <span className="priority-action-link">Teilnehmer prüfen</span>
          </button>

          <button
            className="priority-action-card"
            data-testid="overview-critical-visibility"
            type="button"
            onClick={() => openView?.('events')}
          >
            <div className="row space-between">
              <strong>Nicht veröffentlichte Events</strong>
              <span className={`pill ${unpublishedEvents.length > 0 ? 'status-visibility-internal' : 'info-pill'}`}>
                {unpublishedEvents.length}
              </span>
            </div>
            <p className="muted">
              {unpublishedEvents.length > 0
                ? 'Diese Events sind noch intern und brauchen deinen Blick.'
                : 'Keine internen Events mit direktem Handlungsbedarf.'}
            </p>
            <span className="priority-action-link">Jetzt prüfen</span>
          </button>

          <button
            className="priority-action-card"
            data-testid="overview-critical-payments"
            type="button"
            onClick={() => openParticipantsView?.('offen')}
          >
            <div className="row space-between">
              <strong>Offene Zahlungen</strong>
              <span className={`pill ${participantSummary.offen > 0 ? 'status-payment-open' : 'info-pill'}`}>
                {participantSummary.offen}
              </span>
            </div>
            <p className="muted">
              {participantSummary.offen > 0
                ? 'Offene oder ausstehende Zahlungen sollten geprüft werden.'
                : 'Aktuell ist keine Zahlung offen.'}
            </p>
            <span className="priority-action-link">Zahlungen prüfen</span>
          </button>

          <button
            className="priority-action-card"
            data-testid="overview-critical-issues"
            type="button"
            onClick={() => openView?.('events')}
          >
            <div className="row space-between">
              <strong>Pflichtdaten fehlen</strong>
              <span className={`pill ${eventIssues.length > 0 ? 'status-quality-review' : 'info-pill'}`}>
                {eventIssues.length}
              </span>
            </div>
            <p className="muted">
              {eventIssues.length > 0
                ? 'Einige Events sind noch nicht vollständig für die Veröffentlichung.'
                : 'Keine offenen Pflichtdatenprobleme.'}
            </p>
            <span className="priority-action-link">Events prüfen</span>
          </button>
        </div>
      </section>

      <div className="grid two overview-focus-grid">
        <section className="card overview-next-event-card" data-testid="overview-next-event-card">
          <div className="overview-section-header">
            <div>
              <h2 className="section-title">Nächstes Event</h2>
              <p className="muted">Dein schnellster Einstieg in den operativen Fokus.</p>
            </div>
          </div>
          {focusEvent ? (
            <EventCard
              event={focusEvent}
              issue={eventIssues?.find(issue => issue.id === focusEvent.id)}
              onDelete={setEventToDelete}
              onOpen={openEventDetail}
            />
          ) : (
            <div className="item">
              <strong>Noch kein Event geplant</strong>
              <p className="muted">Lege zuerst ein Event an, damit hier dein nächster Fokus erscheint.</p>
            </div>
          )}
        </section>

        <section className="card timeline-card" data-testid="overview-today-panel">
          <div className="timeline-header">
            <div>
              <h2 className="section-title">Heute relevant</h2>
              <p className="muted">Alles, was heute sichtbar werden oder beantwortet werden sollte.</p>
            </div>
          </div>

          <div className="timeline-section">
            <strong>Events heute</strong>
            <div className="list compact">
              {todayEvents.length === 0 && <p className="muted">Heute ist kein Event eingetragen.</p>}
              {todayEvents.map(event => (
                <button
                  className="item action-list-item"
                  data-testid="overview-today-event"
                  key={event.id}
                  type="button"
                  onClick={() => openEventDetail?.(event)}
                >
                  <strong>{event.title || 'Ohne Eventname'}</strong>
                  <p className="muted">{event.location || 'Ort offen'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="timeline-section timeline-section-todos">
            <strong>Heute fällig</strong>
            <div className="list compact">
              {todayTasks.length === 0 && <p className="muted">Heute ist keine Aufgabe fällig.</p>}
              {todayTasks.map(task => (
                <button
                  className="item action-list-item"
                  data-testid="overview-today-task"
                  key={task.id}
                  type="button"
                  onClick={() => openView?.('tasks')}
                >
                  <strong>{task.title}</strong>
                  <div className="row">
                    <span className={getTaskPriorityClass(task.priority)}>{getTaskPriorityLabel(task.priority)}</span>
                    <span className="pill info-pill">{getTaskScopeLabel(task.scope)}</span>
                  </div>
                  <p className="muted">{task.event_id ? 'Mit Event verknüpft' : 'Allgemeine Aufgabe'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="timeline-section timeline-section-messages">
            <strong>Weitere Bereiche</strong>
            <div className="list compact">
              <div className="item">
                <strong>Mehr-Menü nutzen</strong>
                <p className="muted">
                  {messageCount > 0
                    ? `${messageCount} Mitteilung${messageCount === 1 ? '' : 'en'} und weitere Zusatzmodule findest du gesammelt im Bereich Mehr.`
                    : 'Mitteilungen und weitere Zusatzmodule findest du gesammelt im Bereich Mehr.'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card timeline-card" data-testid="overview-week-panel">
        <div className="timeline-header">
          <div>
            <h2 className="section-title">Diese Woche</h2>
            <p className="muted">Der nächste Planungshorizont, bevor etwas unnötig hektisch wird.</p>
          </div>
          <span className="pill info-pill">{fmtDate(weekEndKey)}</span>
        </div>

        <div className="grid three overview-week-grid">
          <div className="timeline-section">
            <strong>Kommende Events</strong>
            <div className="list compact">
              {thisWeekEvents.length === 0 && (
                <p className="muted">Diese Woche sind keine weiteren Events geplant.</p>
              )}
              {thisWeekEvents.map(event => (
                <button
                  className="item action-list-item"
                  data-testid="overview-week-event"
                  key={event.id}
                  type="button"
                  onClick={() => openEventDetail?.(event)}
                >
                  <strong>{event.title || 'Ohne Eventname'}</strong>
                  <p className="muted">{fmtDate(event.event_date)} · {event.location || 'Ort offen'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="timeline-section timeline-section-participants">
            <strong>Neue Bewerbungen</strong>
            <div className="list compact">
              {pendingParticipants.length === 0 && (
                <p className="muted">Aktuell wartet keine neue Bewerbung auf dich.</p>
              )}
              {pendingParticipants.map(participant => (
                <button
                  className="item action-list-item"
                  data-testid="overview-week-participant"
                  key={participant.id}
                  type="button"
                  onClick={() => openParticipantsView?.('angefragt', participant.event_id || '')}
                >
                  <strong>{participant.exhibitor_name || 'Ohne Namen'}</strong>
                  <p className="muted">{participant.eventTitle}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="timeline-section timeline-section-todos">
            <strong>Offene Vorbereitungen</strong>
            <div className="list compact">
              {thisWeekTasks.length === 0 && (
                <p className="muted">Keine weiteren Vorbereitungen in den nächsten Tagen fällig.</p>
              )}
              {thisWeekTasks.map(task => (
                <button
                  className="item action-list-item"
                  data-testid="overview-week-task"
                  key={task.id}
                  type="button"
                  onClick={() => openView?.('tasks')}
                >
                  <strong>{task.title}</strong>
                  <div className="row">
                    <span className={getTaskPriorityClass(task.priority)}>{getTaskPriorityLabel(task.priority)}</span>
                    <span className="pill info-pill">{getTaskScopeLabel(task.scope)}</span>
                  </div>
                  <p className="muted">Fällig: {fmtDate(task.due_date)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card overview-section-card" data-testid="overview-kpi-section">
        <div className="overview-section-header">
          <div>
            <h2 className="section-title">Kennzahlen mit Kontext</h2>
            <p className="muted">Zahlen nur dann, wenn direkt klar ist, ob daraus eine Aktion entsteht.</p>
          </div>
        </div>
        <div className="overview-kpi-grid">
          {kpiCards.map(card => (
            <button
              key={card.label}
              className={`overview-kpi-card overview-kpi-card-${card.key}`}
              data-testid={`overview-kpi-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
              type="button"
              onClick={card.onClick}
            >
              <span className="muted small">{card.label}</span>
              <strong className="overview-kpi-value">{card.value}</strong>
              <p className="kpi-note">{card.note}</p>
              <span className="priority-action-link">{card.actionLabel}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid two overview-secondary-grid">
        <section
          className="card overview-secondary-card overview-secondary-utility-card"
          data-testid="overview-announcements"
        >
          <h2 className="section-title">Weitere Bereiche</h2>
          <p className="muted">Sekundäre Module bleiben erreichbar, ohne den Arbeitsfokus zu überlagern.</p>
          <div className="list">
            <div className="item">
              <strong>Mehr-Menü nutzen</strong>
              <p className="muted">
                Mitteilungen, Abrechnung, Händlerprofil, E-Mail-Vorlagen, Bewertungen und Verträge sind dort gesammelt gebündelt.
              </p>
            </div>
          </div>
        </section>

        <section className="card overview-secondary-card" data-testid="overview-automation-panel">
          <h2 className="section-title">Sekundär</h2>
          <p className="muted">Ruhige Hinweise für später, wenn der operative Kern schon klar ist.</p>
          <div className="list">
            <div className="item">
              <strong>Automationen</strong>
              <p className="muted">Erst Erinnerungen, später Magie. Aktuell bleibt das bewusst nachgelagert.</p>
            </div>
            {templates.slice(0, 3).map(template => (
              <div className="item" key={template.id}>
                <strong>{template.name}</strong>
                <p className="muted">
                  {template.send_offset_days} Tage vorher · {template.active ? 'aktiv' : 'inaktiv'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ConfirmModal
        open={Boolean(eventToDelete)}
        title="Event wirklich löschen?"
        message={`"${eventToDelete?.title || 'Ohne Eventname'}" wird mit zugehörigen Teilnehmern, ToDos und Mitteilungen entfernt.`}
        busy={deletingEvent}
        onCancel={() => setEventToDelete(null)}
        onConfirm={confirmDeleteEvent}
        testId="delete-event-modal"
      />
    </div>
  )
}
