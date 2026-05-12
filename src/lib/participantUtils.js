export const participantStatusOptions = [
  ['angefragt', 'In Prüfung'],
  ['bestaetigt', 'Bestätigt'],
  ['warteliste', 'Warteliste'],
  ['abgesagt', 'Abgesagt']
]

export const participantFilterOptions = [
  ['alle', 'Alle'],
  ['angefragt', 'In Prüfung'],
  ['bestaetigt', 'Bestätigt'],
  ['warteliste', 'Warteliste'],
  ['abgesagt', 'Abgesagt'],
  ['bezahlt', 'Bezahlt'],
  ['offen', 'Offen']
]

export function getParticipantStatusLabel(status) {
  return participantStatusOptions.find(([value]) => value === status)?.[1] || 'In Prüfung'
}

export function getParticipantStatusClass(status) {
  if (status === 'bestaetigt') return 'pill status-participant-confirmed'
  if (status === 'warteliste') return 'pill status-participant-waitlist'
  if (status === 'abgesagt') return 'pill status-participant-cancelled'
  return 'pill status-participant-review'
}

export function getParticipantStatusErrorMessage(err) {
  const message = err?.message || 'Unbekannter Fehler'

  if (/event_participants.*status|column .*status does not exist|schema cache/i.test(message)) {
    return 'Teilnehmer-Status braucht einmaliges DB-Update. Führe supabase/event_participants_status.sql in Supabase aus.'
  }

  return message
}

export function getParticipantStatusSummary(participants) {
  const safeParticipants = participants || []

  return {
    alle: safeParticipants.length,
    angefragt: safeParticipants.filter(
      participant => (participant.status || 'angefragt') === 'angefragt'
    ).length,
    bestaetigt: safeParticipants.filter(
      participant => (participant.status || (participant.paid ? 'bestaetigt' : 'angefragt')) === 'bestaetigt'
    ).length,
    warteliste: safeParticipants.filter(participant => participant.status === 'warteliste').length,
    abgesagt: safeParticipants.filter(participant => participant.status === 'abgesagt').length,
    bezahlt: safeParticipants.filter(participant => participant.paid).length,
    offen: safeParticipants.filter(participant => !participant.paid).length
  }
}
