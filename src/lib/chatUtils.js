import { fmtDate } from './eventUtils'

export function localAssistantAnswer(question, context) {
  const q = question.toLowerCase()
  const openTasks = context.tasks.filter(task => !task.done)
  const unpaid = context.participants.filter(participant => !participant.paid)
  const nextEvents = [...context.events]
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
    .slice(0, 5)

  if (q.includes('zahlung') || q.includes('bezahlt') || q.includes('offen')) {
    if (!unpaid.length) return 'Aktuell sind keine offenen Zahlungen hinterlegt.'

    return (
      `Offene Zahlungen: ${unpaid.length}.\n\n` +
      unpaid
        .map(
          participant =>
            `• ${participant.exhibitor_name || 'Unbenannter Aussteller'} (${participant.email || 'keine E-Mail'})${
              participant.booth ? `, Stand ${participant.booth}` : ''
            }`
        )
        .join('\n') +
      '\n\nSaubere nächste Aktion: Zahlungserinnerung senden.'
    )
  }

  if (q.includes('todo') || q.includes('aufgabe') || q.includes('kritisch')) {
    if (!openTasks.length) return 'Keine offenen ToDos.'

    return (
      `Offene ToDos: ${openTasks.length}.\n\n` +
      openTasks
        .map(task => `• ${task.title}${task.due_date ? `, fällig am ${fmtDate(task.due_date)}` : ''}`)
        .join('\n')
    )
  }

  if (q.includes('event') || q.includes('markt') || q.includes('veranstaltung')) {
    if (!nextEvents.length) return 'Noch keine Events vorhanden.'

    return (
      'Nächste Events:\n\n' +
      nextEvents
        .map(
          event =>
            `• ${event.title}, ${fmtDate(event.event_date)}, ${event.location || 'Ort offen'} (${event.status || 'Status offen'})`
        )
        .join('\n')
    )
  }

  if (q.includes('mail') || q.includes('email') || q.includes('vorlage')) {
    if (!context.templates.length) return 'Noch keine E-Mail-Vorlagen vorhanden.'
    return `Vorhandene E-Mail-Vorlagen:\n\n${context.templates.map(template => `• ${template.name}: ${template.subject}`).join('\n')}`
  }

  return `Kurzstatus:\n\n• Events: ${context.events.length}\n• Teilnehmer: ${context.participants.length}\n• Offene Zahlungen: ${unpaid.length}\n• Offene ToDos: ${openTasks.length}\n• Mitteilungen: ${context.announcements.length}`
}
