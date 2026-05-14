import { useMemo, useState } from 'react'
import { fmtDate, fmtOpeningHours, fmtTime, getEventVenueFacts } from '../../lib/eventUtils'
import { getParticipantStatusClass, getParticipantStatusLabel } from '../../lib/participantUtils'
import EventStandPricingPreview from './EventStandPricingPreview'

function getTextValue(value) {
  return String(value || '').trim()
}

function formatTimeWindow(startTime, endTime) {
  if (!startTime && !endTime) return ''
  if (startTime && endTime) return `${fmtTime(startTime)} – ${fmtTime(endTime)}`
  if (startTime) return `Ab ${fmtTime(startTime)}`
  return `Bis ${fmtTime(endTime)}`
}

function formatContactLine(name, phone) {
  const safeName = getTextValue(name)
  const safePhone = getTextValue(phone)

  if (safeName && safePhone) return `${safeName} (${safePhone})`
  if (safeName) return safeName
  if (safePhone) return safePhone
  return ''
}

function getParticipantDisplayName(participant) {
  return (
    getTextValue(participant?.exhibitor_name) ||
    getTextValue(participant?.email) ||
    getTextValue(participant?.id) ||
    'Teilnehmer ohne Namen'
  )
}

function getParticipantStatusPriority(status) {
  if (status === 'warteliste') return 1
  if (status === 'bestaetigt') return 2
  if (status === 'abgesagt') return 3
  return 0
}

function buildParticipantPreview(participants = []) {
  const safeParticipants = (participants || [])
    .map((participant, index) => ({
      participant,
      index,
      displayName: getParticipantDisplayName(participant),
      hasBooth: Boolean(getTextValue(participant?.booth)),
      status: participant?.status || 'angefragt'
    }))
    .sort((left, right) => {
      const priorityChecks = [
        Number(Boolean(left.participant?.paid)) - Number(Boolean(right.participant?.paid)),
        Number(left.hasBooth) - Number(right.hasBooth),
        getParticipantStatusPriority(left.status) - getParticipantStatusPriority(right.status)
      ]

      for (const value of priorityChecks) {
        if (value !== 0) return value
      }

      const nameCompare = left.displayName.localeCompare(right.displayName, 'de', { sensitivity: 'base' })
      if (nameCompare !== 0) return nameCompare

      return left.index - right.index
    })

  const activeParticipants = safeParticipants.filter(({ status }) => status !== 'abgesagt')
  const openPaymentIssues = activeParticipants.filter(({ participant }) => !participant.paid).length
  const missingBoothIssues = activeParticipants.filter(({ hasBooth }) => !hasBooth).length
  const reviewIssues = activeParticipants.filter(({ status }) => status === 'angefragt').length
  const waitlistIssues = activeParticipants.filter(({ status }) => status === 'warteliste').length
  const otherOpenStatusIssues = activeParticipants.filter(
    ({ status }) => !['angefragt', 'warteliste', 'bestaetigt', 'abgesagt'].includes(status)
  ).length
  const issueHints = [
    openPaymentIssues > 0 &&
      `${openPaymentIssues} ${openPaymentIssues === 1 ? 'Zahlung offen' : 'Zahlungen offen'}`,
    missingBoothIssues > 0 &&
      `${missingBoothIssues} ${missingBoothIssues === 1 ? 'Teilnehmer ohne Stand' : 'Teilnehmer ohne Stand'}`,
    reviewIssues > 0 &&
      `${reviewIssues} ${reviewIssues === 1 ? 'Teilnehmer in Prüfung' : 'Teilnehmer in Prüfung'}`,
    waitlistIssues > 0 &&
      `${waitlistIssues} ${waitlistIssues === 1 ? 'Teilnehmer auf Warteliste' : 'Teilnehmer auf Warteliste'}`,
    otherOpenStatusIssues > 0 &&
      `${otherOpenStatusIssues} ${
        otherOpenStatusIssues === 1 ? 'Teilnehmer mit offenem Status' : 'Teilnehmer mit offenem Status'
      }`
  ].filter(Boolean)

  return {
    total: safeParticipants.length,
    confirmed: safeParticipants.filter(({ status }) => status === 'bestaetigt').length,
    openPayment: safeParticipants.filter(({ participant }) => !participant.paid).length,
    missingBooth: safeParticipants.filter(({ hasBooth }) => !hasBooth).length,
    issueHints,
    entries: safeParticipants.map(({ participant, displayName, hasBooth, status }, entryIndex) => ({
      key: participant?.id || `${displayName}-${entryIndex}`,
      displayName,
      boothLabel: hasBooth ? `Stand ${getTextValue(participant.booth)}` : 'Stand noch nicht hinterlegt',
      boothMissing: !hasBooth,
      statusLabel: getParticipantStatusLabel(status),
      statusClass: getParticipantStatusClass(status),
      statusOpen: status !== 'bestaetigt' && status !== 'abgesagt',
      paymentLabel: participant.paid ? 'Bezahlt' : 'Zahlung offen',
      paymentClass: participant.paid ? 'pill status-payment-paid' : 'pill status-payment-open',
      paymentOpen: !participant.paid
    })),
    lines: safeParticipants.map(({ participant, displayName, hasBooth, status }) => {
      const parts = [displayName]
      parts.push(
        hasBooth ? `Stand ${getTextValue(participant.booth)}` : 'Stand noch nicht hinterlegt'
      )
      parts.push(getParticipantStatusLabel(status))
      parts.push(participant.paid ? 'Bezahlt' : 'Zahlung offen')
      return parts.join(' · ')
    })
  }
}

function ParticipantBriefingEntry({ entry, testId }) {
  return (
    <div className="item" data-testid={testId}>
      <div className="participant-row">
        <div className="detail-column" style={{ gap: 6 }}>
          <strong>{entry.displayName}</strong>
          <p className="muted small">{entry.boothLabel}</p>
        </div>
        <div className="participant-badges">
          <span className={entry.statusClass}>{entry.statusLabel}</span>
          <span className={entry.paymentClass}>{entry.paymentLabel}</span>
          {entry.boothMissing && <span className="pill info-pill">Stand noch nicht hinterlegt</span>}
        </div>
      </div>
    </div>
  )
}

function ParticipantIssueSummary({ hints, emptyText, testId }) {
  return (
    <div className="item" data-testid={testId}>
      {hints.length > 0 ? (
        <>
          <strong>Offene Teilnehmerpunkte</strong>
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {hints.map(hint => (
              <p className="muted small" key={hint}>
                {hint}
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="muted small">{emptyText}</p>
      )}
    </div>
  )
}

async function writeTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall back to a temporary textarea below.
    }
  }

  if (typeof document === 'undefined') return false

  const helper = document.createElement('textarea')
  helper.value = text
  helper.setAttribute('readonly', 'true')
  helper.style.position = 'absolute'
  helper.style.left = '-9999px'
  helper.style.opacity = '0'
  document.body.appendChild(helper)
  helper.select()
  helper.setSelectionRange(0, helper.value.length)

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  } finally {
    document.body.removeChild(helper)
  }

  return copied
}

function buildSectionItems(event, exhibitorInfo) {
  const openingHours = fmtOpeningHours(event?.opening_time, event?.closing_time)
  const generalNotes = getTextValue(exhibitorInfo?.exhibitor_general_notes)
  const setupWindow = formatTimeWindow(exhibitorInfo?.setup_start_time, exhibitorInfo?.setup_end_time)
  const teardownWindow = formatTimeWindow(exhibitorInfo?.teardown_start_time, exhibitorInfo?.teardown_end_time)
  const arrivalNotes = getTextValue(exhibitorInfo?.arrival_notes)
  const accessNotes = getTextValue(exhibitorInfo?.access_notes)
  const contactPerson = formatContactLine(
    exhibitorInfo?.exhibitor_contact_name,
    exhibitorInfo?.exhibitor_contact_phone
  )
  const emergencyContact = formatContactLine(
    exhibitorInfo?.emergency_contact_name,
    exhibitorInfo?.emergency_contact_phone
  )

  return [
    {
      title: 'Grunddaten',
      items: [
        {
          key: 'title',
          label: 'Eventname',
          required: true,
          available: Boolean(getTextValue(event?.title)),
          value: getTextValue(event?.title)
        },
        {
          key: 'event_date',
          label: 'Datum',
          required: true,
          available: Boolean(event?.event_date),
          value: event?.event_date ? fmtDate(event.event_date) : ''
        },
        {
          key: 'location',
          label: 'Ort',
          required: true,
          available: Boolean(getTextValue(event?.location)),
          value: getTextValue(event?.location)
        },
        {
          key: 'opening_hours',
          label: 'Öffnungszeiten',
          required: true,
          available: Boolean(event?.opening_time || event?.closing_time),
          value: openingHours
        }
      ]
    },
    {
      title: 'Aufbau & Anreise',
      items: [
        {
          key: 'setup_time',
          label: 'Aufbauzeit',
          required: true,
          available: Boolean(setupWindow),
          value: setupWindow
        },
        {
          key: 'arrival_notes',
          label: 'Anfahrt',
          required: true,
          available: Boolean(arrivalNotes),
          value: arrivalNotes
        },
        {
          key: 'access_notes',
          label: 'Einfahrt / Zufahrt',
          required: false,
          available: Boolean(accessNotes),
          value: accessNotes
        }
      ]
    },
    {
      title: 'Abbau',
      items: [
        {
          key: 'teardown_time',
          label: 'Abbauzeit',
          required: true,
          available: Boolean(exhibitorInfo?.teardown_start_time),
          value: teardownWindow
        },
        {
          key: 'teardown_notes',
          label: 'Abbauhinweise',
          required: false,
          available: Boolean(generalNotes),
          value: generalNotes
        }
      ]
    },
    {
      title: 'Kontakt & Hinweise',
      items: [
        {
          key: 'contact_person',
          label: 'Ansprechpartner',
          required: true,
          available: Boolean(
            getTextValue(exhibitorInfo?.exhibitor_contact_name) &&
              getTextValue(exhibitorInfo?.exhibitor_contact_phone)
          ),
          value: contactPerson
        },
        {
          key: 'emergency_contact',
          label: 'Notfallkontakt',
          required: false,
          available: Boolean(
            getTextValue(exhibitorInfo?.emergency_contact_name) &&
              getTextValue(exhibitorInfo?.emergency_contact_phone)
          ),
          value: emergencyContact
        },
        {
          key: 'special_notes',
          label: 'Besondere Hinweise',
          required: false,
          available: Boolean(generalNotes),
          value: generalNotes
        }
      ]
    }
  ]
}

function buildPreviewData(event, exhibitorInfo, sections, venueFacts) {
  const title = getTextValue(event?.title)
  const location = getTextValue(event?.location)
  const openingHours = fmtOpeningHours(event?.opening_time, event?.closing_time)
  const description = getTextValue(event?.public_description || event?.description)
  const setupWindow = formatTimeWindow(exhibitorInfo?.setup_start_time, exhibitorInfo?.setup_end_time)
  const teardownWindow = formatTimeWindow(exhibitorInfo?.teardown_start_time, exhibitorInfo?.teardown_end_time)
  const arrivalNotes = getTextValue(exhibitorInfo?.arrival_notes)
  const accessNotes = getTextValue(exhibitorInfo?.access_notes)
  const exhibitorContactName = getTextValue(exhibitorInfo?.exhibitor_contact_name)
  const exhibitorContactPhone = getTextValue(exhibitorInfo?.exhibitor_contact_phone)
  const emergencyContactName = getTextValue(exhibitorInfo?.emergency_contact_name)
  const emergencyContactPhone = getTextValue(exhibitorInfo?.emergency_contact_phone)
  const powerNotes = getTextValue(exhibitorInfo?.power_notes)
  const parkingNotes = getTextValue(exhibitorInfo?.parking_notes)
  const wasteNotes = getTextValue(exhibitorInfo?.waste_notes)
  const generalNotes = getTextValue(exhibitorInfo?.exhibitor_general_notes)
  const missingItems = sections
    .flatMap(section => section.items)
    .filter(item => item.required && !item.available)

  return {
    title,
    date: event?.event_date ? fmtDate(event.event_date) : '',
    location,
    openingHours: event?.opening_time || event?.closing_time ? openingHours : '',
    description,
    venueFacts,
    setupWindow,
    teardownWindow,
    arrivalNotes,
    accessNotes,
    exhibitorContactName,
    exhibitorContactPhone,
    emergencyContactName,
    emergencyContactPhone,
    powerNotes,
    parkingNotes,
    wasteNotes,
    generalNotes,
    missingItems
  }
}

function buildDraftSections(preview) {
  const sections = [
    {
      key: 'event',
      title: 'Veranstaltung',
      lines: [
        preview.title && `Name: ${preview.title}`,
        preview.date && `Datum: ${preview.date}`,
        preview.location && `Ort: ${preview.location}`
      ].filter(Boolean)
    },
    {
      key: 'opening-hours',
      title: 'Öffnungszeiten',
      lines: [preview.openingHours && `Öffnungszeiten: ${preview.openingHours}`].filter(Boolean)
    },
    {
      key: 'setup',
      title: 'Aufbau',
      lines: [preview.setupWindow && `Aufbau: ${preview.setupWindow}`].filter(Boolean)
    },
    {
      key: 'arrival',
      title: 'Anfahrt & Zufahrt',
      lines: [
        preview.arrivalNotes && `Anfahrt: ${preview.arrivalNotes}`,
        preview.accessNotes && `Zufahrt: ${preview.accessNotes}`
      ].filter(Boolean)
    },
    {
      key: 'teardown',
      title: 'Abbau',
      lines: [preview.teardownWindow && `Abbau: ${preview.teardownWindow}`].filter(Boolean)
    },
    {
      key: 'contact',
      title: 'Kontakt vor Ort',
      lines: [
        preview.exhibitorContactName &&
          `Ansprechpartner: ${preview.exhibitorContactName}${
            preview.exhibitorContactPhone ? ` (${preview.exhibitorContactPhone})` : ''
          }`,
        preview.emergencyContactName &&
          `Notfallkontakt: ${preview.emergencyContactName}${
            preview.emergencyContactPhone ? ` (${preview.emergencyContactPhone})` : ''
          }`
      ].filter(Boolean)
    },
    {
      key: 'notes',
      title: 'Vorhandene Hinweise',
      lines: [preview.description, preview.generalNotes].filter(Boolean)
    },
    {
      key: 'facts',
      title: 'Vorhandene Ausstattung / Merkmale',
      lines: [
        ...preview.venueFacts,
        preview.powerNotes && `Strom: ${preview.powerNotes}`,
        preview.parkingNotes && `Parken: ${preview.parkingNotes}`,
        preview.wasteNotes && `Müll / Entsorgung: ${preview.wasteNotes}`
      ].filter(Boolean)
    }
  ]

  return sections.filter(section => section.lines.length > 0)
}

function buildBriefingSections(preview, participantPreview) {
  const sections = [
    {
      key: 'event',
      title: 'Veranstaltung',
      lines: [
        preview.title || 'Ohne Eventname',
        preview.date ? `Datum: ${preview.date}` : 'Datum noch nicht hinterlegt.',
        preview.location ? `Ort: ${preview.location}` : 'Ort noch nicht hinterlegt.',
        preview.openingHours ? `Öffnungszeiten: ${preview.openingHours}` : 'Öffnungszeiten noch nicht hinterlegt.'
      ]
    },
    {
      key: 'setup',
      title: 'Aufbau',
      lines: [
        preview.setupWindow
          ? preview.setupWindow.includes('–')
            ? `Du kannst von ${preview.setupWindow} aufbauen.`
            : `Der Aufbau ist ${preview.setupWindow.toLowerCase()} möglich.`
          : 'Aufbauzeit noch nicht vollständig hinterlegt.'
      ]
    },
    {
      key: 'arrival',
      title: 'Anfahrt & Zufahrt',
      lines: [
        preview.arrivalNotes ? `Anfahrt: ${preview.arrivalNotes}` : 'Anfahrt noch nicht hinterlegt.',
        preview.accessNotes ? `Zufahrt: ${preview.accessNotes}` : 'Zufahrt noch nicht hinterlegt.'
      ]
    },
    {
      key: 'teardown',
      title: 'Abbau',
      lines: [
        preview.teardownWindow
          ? preview.teardownWindow.includes('–')
            ? `Der Abbau ist von ${preview.teardownWindow} vorgesehen.`
            : preview.teardownWindow.startsWith('Ab ')
              ? `Der Abbau startet ${preview.teardownWindow.toLowerCase()}.`
              : `Abbauzeit: ${preview.teardownWindow}.`
          : 'Abbauzeit noch nicht hinterlegt.'
      ]
    },
    {
      key: 'logistics',
      title: 'Ausstattung & Logistik',
      lines: [
        preview.powerNotes && `Strom: ${preview.powerNotes}`,
        preview.parkingNotes && `Parken: ${preview.parkingNotes}`,
        preview.wasteNotes && `Müll / Entsorgung: ${preview.wasteNotes}`,
        preview.generalNotes && `Weitere Hinweise: ${preview.generalNotes}`,
        ...preview.venueFacts
      ].filter(Boolean)
    },
    {
      key: 'contact',
      title: 'Kontakt',
      lines: [
        preview.exhibitorContactName
          ? `Ansprechpartner: ${preview.exhibitorContactName}${
              preview.exhibitorContactPhone ? ` (${preview.exhibitorContactPhone})` : ''
            }`
          : 'Ansprechpartner noch nicht hinterlegt.',
        preview.emergencyContactName
          ? `Notfallkontakt: ${preview.emergencyContactName}${
              preview.emergencyContactPhone ? ` (${preview.emergencyContactPhone})` : ''
            }`
          : 'Notfallkontakt noch nicht hinterlegt.'
      ]
    },
    {
      key: 'participants',
      title: 'Teilnehmer & Standinformationen',
      summary:
        participantPreview.total > 0
          ? [
              `${participantPreview.total} Teilnehmer`,
              `${participantPreview.confirmed} bestätigt`,
              `${participantPreview.openPayment} Zahlung offen`,
              `${participantPreview.missingBooth} ohne Stand`
            ]
          : [],
      hint:
        participantPreview.total > 0
          ? 'Diese Angaben stammen aus der Teilnehmerliste des Events.'
          : 'Sobald Teilnehmer angelegt sind, erscheinen hier Stand- und Zahlungsinformationen.',
      issueHints: participantPreview.issueHints,
      entries: participantPreview.total > 0 ? participantPreview.entries : [],
      lines:
        participantPreview.total > 0
          ? participantPreview.lines
          : ['Noch keine Teilnehmer für dieses Event hinterlegt.']
    }
  ]

  return sections
    .map(section => ({
      ...section,
      lines: section.key === 'logistics' ? section.lines : section.lines.filter(Boolean)
    }))
    .filter(section => section.key !== 'logistics' || section.lines.length > 0)
}

function buildPrintPreviewSections(preview, participantPreview) {
  const logisticsLines = [
    ...preview.venueFacts,
    preview.powerNotes && `Strom: ${preview.powerNotes}`,
    preview.parkingNotes && `Parken: ${preview.parkingNotes}`,
    preview.wasteNotes && `Müll / Entsorgung: ${preview.wasteNotes}`,
    preview.generalNotes && `Weitere Hinweise: ${preview.generalNotes}`
  ].filter(Boolean)

  return [
    {
      key: 'setup',
      title: 'Aufbau',
      lines: [preview.setupWindow ? `Aufbau: ${preview.setupWindow}` : 'Aufbauzeit noch nicht vollständig hinterlegt.']
    },
    {
      key: 'arrival',
      title: 'Anfahrt & Zufahrt',
      lines: [
        preview.arrivalNotes ? `Anfahrt: ${preview.arrivalNotes}` : 'Anfahrt noch nicht hinterlegt.',
        preview.accessNotes ? `Zufahrt: ${preview.accessNotes}` : 'Zufahrt noch nicht hinterlegt.'
      ]
    },
    {
      key: 'teardown',
      title: 'Abbau',
      lines: [preview.teardownWindow ? `Abbau: ${preview.teardownWindow}` : 'Abbauzeit noch nicht hinterlegt.']
    },
    {
      key: 'logistics',
      title: 'Ausstattung & Logistik',
      lines: logisticsLines.length > 0 ? logisticsLines : ['Noch keine zusätzlichen Hinweise hinterlegt.']
    },
    {
      key: 'contact',
      title: 'Kontakt vor Ort',
      lines: [
        preview.exhibitorContactName
          ? `Ansprechpartner: ${preview.exhibitorContactName}${
              preview.exhibitorContactPhone ? ` (${preview.exhibitorContactPhone})` : ''
            }`
          : 'Ansprechpartner noch nicht hinterlegt.',
        preview.emergencyContactName
          ? `Notfallkontakt: ${preview.emergencyContactName}${
              preview.emergencyContactPhone ? ` (${preview.emergencyContactPhone})` : ''
            }`
          : 'Notfallkontakt noch nicht hinterlegt.'
      ]
    },
    {
      key: 'participants',
      title: 'Teilnehmer & Standinformationen',
      summary:
        participantPreview.total > 0
          ? [
              `${participantPreview.total} Teilnehmer`,
              `${participantPreview.confirmed} bestätigt`,
              `${participantPreview.openPayment} Zahlung offen`,
              `${participantPreview.missingBooth} ohne Stand`
            ]
          : [],
      hint:
        participantPreview.total > 0
          ? 'Diese Angaben stammen aus der Teilnehmerliste des Events.'
          : 'Sobald Teilnehmer angelegt sind, erscheinen hier Stand- und Zahlungsinformationen.',
      issueHints: participantPreview.issueHints,
      entries: participantPreview.total > 0 ? participantPreview.entries : [],
      lines:
        participantPreview.total > 0
          ? participantPreview.lines
          : ['Noch keine Teilnehmer für dieses Event hinterlegt.']
    }
  ]
}

function buildContactLines(preview) {
  return [
    preview.exhibitorContactName &&
      `Ansprechpartner: ${preview.exhibitorContactName}${
        preview.exhibitorContactPhone ? ` (${preview.exhibitorContactPhone})` : ''
      }`,
    preview.emergencyContactName &&
      `Notfallkontakt: ${preview.emergencyContactName}${
        preview.emergencyContactPhone ? ` (${preview.emergencyContactPhone})` : ''
      }`
  ].filter(Boolean)
}

function buildLogisticsLines(preview) {
  return [
    preview.powerNotes && `Strom: ${preview.powerNotes}`,
    preview.parkingNotes && `Parken: ${preview.parkingNotes}`,
    preview.wasteNotes && `Müll / Entsorgung: ${preview.wasteNotes}`,
    preview.generalNotes && `Weitere Hinweise: ${preview.generalNotes}`,
    ...preview.venueFacts
  ].filter(Boolean)
}

function buildParticipantSummaryLines(participantPreview) {
  if (participantPreview.total === 0) return ['Aktuell noch keine Teilnehmer hinterlegt.']

  return [
    `${participantPreview.total} Teilnehmer insgesamt`,
    `${participantPreview.confirmed} bestätigt`,
    `${participantPreview.openPayment} Zahlung offen`,
    `${participantPreview.missingBooth} ohne Stand`,
    ...participantPreview.issueHints
  ]
}

function appendMissingItems(lines, preview, bulletPrefix = '- ') {
  if (preview.missingItems.length === 0) return
  lines.push('', 'Noch offen vor finaler Weitergabe:')
  preview.missingItems.forEach(item => {
    lines.push(`${bulletPrefix}${item.label}`)
  })
}

function buildStandardCopyBriefingMessage(preview, participantPreview) {
  const lines = ['Hallo zusammen,', '', 'hier kommen die aktuellen Informationen zum Event:']

  const appendSection = (title, sectionLines) => {
    const safeLines = sectionLines.filter(Boolean)
    if (safeLines.length === 0) return
    lines.push('', `${title}:`)
    safeLines.forEach(line => {
      lines.push(line)
    })
  }

  appendSection('Event', [
    preview.title && `Event: ${preview.title}`,
    preview.date && `Datum: ${preview.date}`,
    preview.location && `Ort: ${preview.location}`,
    preview.openingHours && `Öffnungszeiten: ${preview.openingHours}`
  ])
  appendSection('Aufbau', [preview.setupWindow && `Aufbau: ${preview.setupWindow}`])
  appendSection('Anfahrt & Zufahrt', [
    preview.arrivalNotes && `Anfahrt: ${preview.arrivalNotes}`,
    preview.accessNotes && `Zufahrt: ${preview.accessNotes}`
  ])
  appendSection('Abbau', [preview.teardownWindow && `Abbau: ${preview.teardownWindow}`])
  appendSection('Ausstattung & Logistik', buildLogisticsLines(preview))
  appendSection('Kontakt', buildContactLines(preview))
  appendSection('Teilnehmerhinweis', buildParticipantSummaryLines(participantPreview))
  appendMissingItems(lines, preview)
  lines.push('', 'Viele Grüße')
  return lines.join('\n')
}

function buildShortCopyBriefingMessage(preview, participantPreview) {
  const lines = [
    'Hallo zusammen,',
    '',
    [
      preview.title || 'Event ohne Titel',
      preview.date,
      preview.location
    ]
      .filter(Boolean)
      .join(' · ')
  ]

  if (preview.openingHours) lines.push(`Öffnungszeiten: ${preview.openingHours}`)
  if (preview.setupWindow) lines.push(`Aufbau: ${preview.setupWindow}`)
  if (preview.arrivalNotes) lines.push(`Anfahrt: ${preview.arrivalNotes}`)
  if (preview.accessNotes) lines.push(`Zufahrt: ${preview.accessNotes}`)
  if (preview.teardownWindow) lines.push(`Abbau: ${preview.teardownWindow}`)

  const logisticsLines = buildLogisticsLines(preview)
  if (logisticsLines.length > 0) {
    lines.push('', 'Logistik:')
    logisticsLines.forEach(line => lines.push(`- ${line}`))
  }

  const contactLines = buildContactLines(preview)
  if (contactLines.length > 0) {
    lines.push('', 'Kontakt:')
    contactLines.forEach(line => lines.push(`- ${line}`))
  }

  lines.push('', 'Teilnehmerhinweis:')
  buildParticipantSummaryLines(participantPreview).forEach(line => lines.push(`- ${line}`))
  appendMissingItems(lines, preview)
  lines.push('', 'Viele Grüße')
  return lines.join('\n')
}

function buildChecklistCopyBriefingMessage(preview, participantPreview) {
  const lines = ['Hallo zusammen,', '', 'Checkliste zum Briefing:']

  const appendChecklistSection = (title, sectionLines) => {
    const safeLines = sectionLines.filter(Boolean)
    if (safeLines.length === 0) return
    lines.push(`- ${title}:`)
    safeLines.forEach(line => {
      lines.push(`  - ${line}`)
    })
  }

  appendChecklistSection('Event', [
    preview.title && `Event: ${preview.title}`,
    preview.date && `Datum: ${preview.date}`,
    preview.location && `Ort: ${preview.location}`,
    preview.openingHours && `Öffnungszeiten: ${preview.openingHours}`
  ])
  appendChecklistSection('Aufbau', [preview.setupWindow && `Aufbau: ${preview.setupWindow}`])
  appendChecklistSection('Anfahrt', [
    preview.arrivalNotes && `Anfahrt: ${preview.arrivalNotes}`,
    preview.accessNotes && `Zufahrt: ${preview.accessNotes}`
  ])
  appendChecklistSection('Abbau', [preview.teardownWindow && `Abbau: ${preview.teardownWindow}`])
  appendChecklistSection('Kontakt', buildContactLines(preview))
  appendChecklistSection('Ausstattung & Logistik', buildLogisticsLines(preview))
  appendChecklistSection('Teilnehmerhinweis', buildParticipantSummaryLines(participantPreview))
  appendMissingItems(lines, preview, '- ')
  lines.push('', 'Viele Grüße')
  return lines.join('\n')
}

function buildCopyBriefingVariants(preview, participantPreview) {
  return [
    {
      key: 'standard',
      label: 'Standard',
      body: buildStandardCopyBriefingMessage(preview, participantPreview)
    },
    {
      key: 'short',
      label: 'Kurz',
      body: buildShortCopyBriefingMessage(preview, participantPreview)
    },
    {
      key: 'checklist',
      label: 'Checkliste',
      body: buildChecklistCopyBriefingMessage(preview, participantPreview)
    }
  ]
}

function ReadinessItem({ item }) {
  const statusLabel = item.available ? 'Vorhanden' : item.required ? 'Fehlt noch' : 'Optional'
  const statusClass = item.available ? 'ok' : item.required ? 'status-quality-review' : 'info-pill'
  const description = item.available
    ? item.value
    : 'Diese Angabe ist aktuell noch nicht im Event hinterlegt.'

  return (
    <div className="item" data-testid={`event-exhibitor-info-item-${item.key}`}>
      <div className="row space-between">
        <strong>{item.label}</strong>
        <span className={`pill ${statusClass}`}>{statusLabel}</span>
      </div>
      <p className="muted small">{description}</p>
    </div>
  )
}

export default function EventExhibitorInfoSection({
  selectedEvent,
  exhibitorInfo = null,
  participants = [],
  notify,
  onEditEvent,
  standOptions = [],
  priceTiers = [],
  addonOptions = []
}) {
  const [copyFeedback, setCopyFeedback] = useState('')
  const [activeCopyVariant, setActiveCopyVariant] = useState('standard')
  const [briefingExpanded, setBriefingExpanded] = useState(false)
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const sections = buildSectionItems(selectedEvent, exhibitorInfo)
  const requiredItems = sections.flatMap(section => section.items).filter(item => item.required)
  const availableRequiredItems = requiredItems.filter(item => item.available)
  const missingRequiredItems = requiredItems.length - availableRequiredItems.length
  const venueFacts = getEventVenueFacts(selectedEvent)
    .filter(([enabled]) => Boolean(enabled))
    .map(([, label]) => label)
  const preview = buildPreviewData(selectedEvent, exhibitorInfo, sections, venueFacts)
  const draftSections = buildDraftSections(preview)
  const participantPreview = buildParticipantPreview(participants)
  const briefingSections = buildBriefingSections(preview, participantPreview)
  const printPreviewSections = buildPrintPreviewSections(preview, participantPreview)
  const briefingReady = missingRequiredItems === 0
  const copyVariants = useMemo(
    () => buildCopyBriefingVariants(preview, participantPreview),
    [participantPreview, preview]
  )
  const selectedCopyVariant =
    copyVariants.find(variant => variant.key === activeCopyVariant) || copyVariants[0]
  const copyMessage = selectedCopyVariant.body
  const briefingStatusText = `${availableRequiredItems.length} von ${requiredItems.length} Pflichtangaben vorhanden`
  const briefingMissingText =
    missingRequiredItems > 0
      ? `Noch ${missingRequiredItems} Angaben fehlen.`
      : 'Alle Pflichtangaben sind vorbereitet.'

  function handleCopyVariantChange(variantKey) {
    setActiveCopyVariant(variantKey)
    setCopyFeedback('')
  }

  async function handleCopyBriefingMessage() {
    const copied = await writeTextToClipboard(copyMessage)
    if (copied) {
      setCopyFeedback('Briefing-Text wurde kopiert.')
      notify?.('success', 'Briefing-Text wurde kopiert.')
      return
    }

    setCopyFeedback('Briefing-Text konnte nicht kopiert werden.')
    notify?.('error', 'Briefing-Text konnte nicht kopiert werden.')
  }

  return (
    <section className="card grid" data-testid="event-exhibitor-info-section">
      <div className="row space-between">
        <div>
          <h2>Ausstellerinfos vorbereiten</h2>
          <p className="muted">Prüfe, ob die wichtigsten Informationen für Aussteller bereits vorhanden sind.</p>
          <p className="small muted">Diese Vorschau hilft dir, Ausstellerinfos vollständig vorzubereiten.</p>
        </div>
        <div className="grid" style={{ gap: 8, justifyItems: 'end' }}>
          <span
            className={`pill ${missingRequiredItems === 0 ? 'ok' : 'status-quality-review'}`}
            data-testid="event-exhibitor-info-status"
          >
            {availableRequiredItems.length} von {requiredItems.length} Pflichtangaben vorhanden
          </span>
          {missingRequiredItems > 0 ? (
            <p className="small muted" data-testid="event-exhibitor-info-missing-summary">
              Noch {missingRequiredItems} Angaben fehlen
            </p>
          ) : (
            <p className="small muted" data-testid="event-exhibitor-info-missing-summary">
              Alle Pflichtangaben sind vorbereitet.
            </p>
          )}
        </div>
      </div>

      {venueFacts.length > 0 && (
        <div className="row" data-testid="event-exhibitor-info-facts">
          {venueFacts.map(fact => (
            <span className="pill info-pill" key={fact}>
              {fact}
            </span>
          ))}
        </div>
      )}

      <div className="grid" data-testid="event-exhibitor-info-group-preparation" style={{ gap: 12 }}>
        <div>
          <h3 className="section-title">Vorbereitung</h3>
          <p className="small muted">Prüfe zuerst, ob alle Pflichtangaben für Aussteller hinterlegt sind.</p>
        </div>

        <div className="item detail-column" data-testid="event-exhibitor-info-briefing-status-card">
          <div className="row space-between" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h4 className="section-title" data-testid="event-exhibitor-info-briefing-status-title">
                {briefingReady ? 'Briefing vollständig vorbereitet' : 'Briefing noch unvollständig'}
              </h4>
              <p className="small muted" data-testid="event-exhibitor-info-briefing-status-text">
                {briefingReady
                  ? 'Alle Pflichtangaben sind hinterlegt.'
                  : `Noch ${missingRequiredItems} Pflichtangaben fehlen.`}
              </p>
            </div>
            <span
              className={`pill ${briefingReady ? 'ok' : 'status-quality-review'}`}
              data-testid="event-exhibitor-info-briefing-status-pill"
            >
              {briefingReady ? 'Bereit' : 'Offen'}
            </span>
          </div>

          {preview.missingItems.length > 0 && (
          <div className="item" data-testid="event-exhibitor-info-briefing-status-missing">
              <strong>Fehlende Pflichtangaben</strong>
              <ul className="muted small">
                {preview.missingItems.map(item => (
                  <li key={item.key}>{item.label}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="muted small" data-testid="event-exhibitor-info-briefing-next-step">
            {briefingReady
              ? 'Das Briefing ist als Grundlage für Kopie, Versand oder PDF vorbereitet.'
              : 'Ergänze die fehlenden Angaben im Eventformular, bevor du das Briefing weiterverwendest.'}
          </p>

          <div className="row compact-wrap" style={{ marginTop: 8 }}>
            <button
              className="btn secondary"
              data-testid="event-exhibitor-info-edit-event"
              onClick={onEditEvent}
              type="button"
            >
              Event bearbeiten
            </button>
          </div>
        </div>

        <div className="grid two">
          {sections.map(section => (
            <div
              className="item detail-column"
              data-testid={`event-exhibitor-info-section-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              key={section.title}
            >
              <h4 className="section-title">{section.title}</h4>
              <div className="detail-list">
                {section.items.map(item => (
                  <ReadinessItem item={item} key={item.key} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid" data-testid="event-exhibitor-info-group-briefing" style={{ gap: 12 }}>
        <div className="row space-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 className="section-title">Briefing</h3>
            <p className="small muted">Diese Inhalte dienen als Grundlage für spätere Kommunikation.</p>
          </div>
          <div className="grid" style={{ gap: 8, justifyItems: 'end' }}>
            <span className={`pill ${briefingReady ? 'ok' : 'status-quality-review'}`}>
              {briefingStatusText}
            </span>
            <p
              className="small muted"
              data-testid="event-exhibitor-info-briefing-collapsed-summary"
            >
              {briefingMissingText}
            </p>
            <button
              className="btn ghost"
              data-testid="event-exhibitor-info-briefing-toggle"
              onClick={() => setBriefingExpanded(current => !current)}
              type="button"
            >
              {briefingExpanded ? 'Briefing ausblenden' : 'Briefing anzeigen'}
            </button>
          </div>
        </div>

        {briefingExpanded ? (
          <>
        <div className="item detail-column" data-testid="event-exhibitor-info-briefing">
          <div>
            <h4 className="section-title">Aussteller-Briefing</h4>
            <p className="small muted">
              Diese Ansicht zeigt die wichtigsten Informationen aus Sicht der Aussteller.
            </p>
          </div>

          <div className="detail-list">
            {briefingSections.map(section => (
              <div className="item" data-testid={`event-exhibitor-info-briefing-${section.key}`} key={section.key}>
                <strong>{section.title}</strong>
                {section.summary?.length > 0 && (
                  <div className="row" data-testid={`event-exhibitor-info-briefing-${section.key}-summary`}>
                    {section.summary.map(item => (
                      <span className="pill info-pill" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                )}
                {section.hint && (
                  <p
                    className="muted small"
                    data-testid={`event-exhibitor-info-briefing-${section.key}-hint`}
                    style={{ marginTop: 8 }}
                  >
                    {section.hint}
                  </p>
                )}
                {section.issueHints && (
                  <ParticipantIssueSummary
                    emptyText="Keine offenen Teilnehmerpunkte aus den vorhandenen Daten erkannt."
                    hints={section.issueHints}
                    testId={`event-exhibitor-info-briefing-${section.key}-issues`}
                  />
                )}
                {section.entries?.length > 0 ? (
                  <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                    {section.entries.map(entry => (
                      <ParticipantBriefingEntry
                        entry={entry}
                        key={entry.key}
                        testId={`event-exhibitor-info-briefing-${section.key}-${entry.key}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid" style={{ gap: 6, marginTop: 8 }}>
                    {section.lines.map(line => (
                      <p className="muted small" key={line}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="item" data-testid="event-exhibitor-info-briefing-missing">
              <strong>Noch offen für ein vollständiges Briefing:</strong>
              {preview.missingItems.length > 0 ? (
                <ul className="muted small">
                  {preview.missingItems.map(item => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Alle Pflichtangaben für das Briefing sind hinterlegt.</p>
              )}
            </div>
          </div>
        </div>

        <div className="item detail-column" data-testid="event-exhibitor-info-preview">
          <div>
            <h4 className="section-title">Vorschau für Aussteller</h4>
            <p className="small muted">
              Diese Vorschau nutzt nur vorhandene Eventdaten. Fehlende Angaben bleiben sichtbar.
            </p>
          </div>

          <div className="detail-list">
            <div className="item" data-testid="event-exhibitor-info-preview-summary">
              <strong>{preview.title || 'Ohne Eventname'}</strong>
              <p className="muted small">
                {preview.date || 'Datum fehlt'}
                {preview.location ? ` - ${preview.location}` : ' - Ort fehlt'}
              </p>
              {preview.openingHours && <p className="muted small">Öffnungszeiten: {preview.openingHours}</p>}
            </div>

            {preview.description && (
              <div className="item" data-testid="event-exhibitor-info-preview-description">
                <strong>Hinweis zum Event</strong>
                <p className="muted small">{preview.description}</p>
              </div>
            )}

            {preview.setupWindow && (
              <div className="item" data-testid="event-exhibitor-info-preview-setup">
                <strong>Aufbau</strong>
                <p className="muted small">{preview.setupWindow}</p>
              </div>
            )}

            {preview.arrivalNotes && (
              <div className="item" data-testid="event-exhibitor-info-preview-arrival">
                <strong>Anfahrt</strong>
                <p className="muted small">{preview.arrivalNotes}</p>
              </div>
            )}

            {preview.accessNotes && (
              <div className="item" data-testid="event-exhibitor-info-preview-access">
                <strong>Einfahrt / Zufahrt</strong>
                <p className="muted small">{preview.accessNotes}</p>
              </div>
            )}

            {preview.teardownWindow && (
              <div className="item" data-testid="event-exhibitor-info-preview-teardown">
                <strong>Abbau</strong>
                <p className="muted small">{preview.teardownWindow}</p>
              </div>
            )}

            {(preview.exhibitorContactName || preview.exhibitorContactPhone) && (
              <div className="item" data-testid="event-exhibitor-info-preview-contact">
                <strong>Kontakt vor Ort</strong>
                <p className="muted small">
                  {preview.exhibitorContactName || 'Name fehlt'}
                  {preview.exhibitorContactPhone ? ` (${preview.exhibitorContactPhone})` : ''}
                </p>
              </div>
            )}

            {(preview.emergencyContactName || preview.emergencyContactPhone) && (
              <div className="item" data-testid="event-exhibitor-info-preview-emergency">
                <strong>Notfallkontakt</strong>
                <p className="muted small">
                  {preview.emergencyContactName || 'Name fehlt'}
                  {preview.emergencyContactPhone ? ` (${preview.emergencyContactPhone})` : ''}
                </p>
              </div>
            )}

            {(preview.powerNotes || preview.parkingNotes || preview.wasteNotes || preview.generalNotes) && (
              <div className="item" data-testid="event-exhibitor-info-preview-logistics">
                <strong>Optionale Logistikhinweise</strong>
                <div className="grid" style={{ gap: 6, marginTop: 8 }}>
                  {preview.powerNotes && <p className="muted small">Strom: {preview.powerNotes}</p>}
                  {preview.parkingNotes && <p className="muted small">Parken: {preview.parkingNotes}</p>}
                  {preview.wasteNotes && <p className="muted small">Müll / Entsorgung: {preview.wasteNotes}</p>}
                  {preview.generalNotes && <p className="muted small">Weitere Hinweise: {preview.generalNotes}</p>}
                </div>
              </div>
            )}

            {preview.venueFacts.length > 0 && (
              <div className="item" data-testid="event-exhibitor-info-preview-facts">
                <strong>Vorhandene Merkmale</strong>
                <div className="row">
                  {preview.venueFacts.map(fact => (
                    <span className="pill info-pill" key={fact}>
                      {fact}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="item" data-testid="event-exhibitor-info-preview-missing">
              <strong>Noch zu ergänzen:</strong>
              {preview.missingItems.length > 0 ? (
                <ul className="muted small">
                  {preview.missingItems.map(item => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Aktuell sind alle Pflichtangaben in dieser Vorschau vorhanden.</p>
              )}
            </div>
          </div>
        </div>

        <div className="item detail-column" data-testid="event-exhibitor-info-draft">
          <div>
            <h4 className="section-title">Textentwurf aus vorhandenen Angaben</h4>
            <p className="small muted">
              Dieser Entwurf nutzt nur vorhandene Daten. Fehlende Angaben werden nicht ergänzt.
            </p>
          </div>

          <div className="detail-list">
            {draftSections.map(section => (
              <div className="item" data-testid={`event-exhibitor-info-draft-${section.key}`} key={section.title}>
                <strong>{section.title}</strong>
                <div className="grid" style={{ gap: 6, marginTop: 8 }}>
                  {section.lines.map(line => (
                    <p className="muted small" key={line}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            <div className="item" data-testid="event-exhibitor-info-draft-missing">
              <strong>Noch offen für die finale Ausstellerinfo:</strong>
              {preview.missingItems.length > 0 ? (
                <ul className="muted small">
                  {preview.missingItems.map(item => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Aktuell sind alle Pflichtangaben für die finale Ausstellerinfo vorhanden.</p>
              )}
            </div>
          </div>
        </div>

        <div className="item detail-column" data-testid="event-exhibitor-info-copy-message">
          <div>
            <h4 className="section-title">Kopierbare Briefing-Nachricht</h4>
            <p className="small muted">
              Diese Nachricht ist als Grundlage für E-Mail oder Messenger gedacht. Versand erfolgt
              noch nicht automatisch.
            </p>
          </div>

          <div
            className="row"
            data-testid="event-exhibitor-info-copy-message-variants"
            style={{ gap: 8, flexWrap: 'wrap' }}
          >
            {copyVariants.map(variant => (
              <button
                className={`btn ${selectedCopyVariant.key === variant.key ? 'secondary' : 'ghost'}`}
                data-testid={`event-exhibitor-info-copy-message-variant-${variant.key}`}
                key={variant.key}
                onClick={() => handleCopyVariantChange(variant.key)}
                type="button"
              >
                {variant.label}
              </button>
            ))}
          </div>

          {!briefingReady && (
            <div className="item" data-testid="event-exhibitor-info-copy-message-warning">
              <strong>Das Briefing ist noch unvollständig.</strong>
              <p className="muted small">Prüfe die offenen Angaben vor dem Versand.</p>
            </div>
          )}

          <div className="item" data-testid="event-exhibitor-info-copy-message-body">
            <div className="muted small" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {copyMessage}
            </div>
          </div>

          <div className="grid" style={{ gap: 8, justifyItems: 'start' }}>
            <button
              className="btn secondary"
              data-testid="event-exhibitor-info-copy-message-button"
              onClick={handleCopyBriefingMessage}
              type="button"
            >
              {selectedCopyVariant.label === 'Standard'
                ? 'Briefing-Text kopieren'
                : `${selectedCopyVariant.label} kopieren`}
            </button>
            {copyFeedback ? (
              <p
                className="small muted"
                data-testid="event-exhibitor-info-copy-message-feedback"
              >
                {copyFeedback}
              </p>
            ) : null}
          </div>
        </div>
          </>
        ) : null}
      </div>

      <div className="grid" data-testid="event-exhibitor-info-group-internal-preview" style={{ gap: 12 }}>
        <div className="row space-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 className="section-title">Interne Vorschau</h3>
            <p className="small muted">Diese Vorschau ist für die interne Prüfung vorbereitet.</p>
          </div>
          <div className="grid" style={{ gap: 8, justifyItems: 'end' }}>
            <p className="small muted" data-testid="event-exhibitor-info-preview-collapsed-summary">
              Preisvorschau und Druckansicht nur bei Bedarf öffnen.
            </p>
            <button
              className="btn ghost"
              data-testid="event-exhibitor-info-preview-toggle"
              onClick={() => setPreviewExpanded(current => !current)}
              type="button"
            >
              {previewExpanded ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
            </button>
          </div>
        </div>

        {previewExpanded ? (
          <>
        <div className="item detail-column" data-testid="event-exhibitor-info-print-preview">
          <div>
            <h4 className="section-title">Druckfreundliche Vorschau</h4>
            <p className="small muted">
              Diese Vorschau ist für die interne Prüfung vorbereitet. Export und Versand folgen später.
            </p>
          </div>

          <div className="detail-list">
            <div className="item" data-testid="event-exhibitor-info-print-preview-summary">
              <strong>{preview.title || 'Ohne Eventname'}</strong>
              <p className="muted small">
                {preview.date || 'Datum fehlt'}
                {preview.location ? ` - ${preview.location}` : ' - Ort fehlt'}
              </p>
              {preview.openingHours && <p className="muted small">Öffnungszeiten: {preview.openingHours}</p>}
            </div>

            {printPreviewSections.map(section => (
              <div
                className="item"
                data-testid={`event-exhibitor-info-print-preview-${section.key}`}
                key={section.key}
              >
                <strong>{section.title}</strong>
                {section.summary?.length > 0 && (
                  <div className="row" data-testid={`event-exhibitor-info-print-preview-${section.key}-summary`}>
                    {section.summary.map(item => (
                      <span className="pill info-pill" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                )}
                {section.hint && (
                  <p
                    className="muted small"
                    data-testid={`event-exhibitor-info-print-preview-${section.key}-hint`}
                    style={{ marginTop: 8 }}
                  >
                    {section.hint}
                  </p>
                )}
                {section.issueHints && (
                  <ParticipantIssueSummary
                    emptyText="Keine offenen Teilnehmerpunkte aus den vorhandenen Daten erkannt."
                    hints={section.issueHints}
                    testId={`event-exhibitor-info-print-preview-${section.key}-issues`}
                  />
                )}
                {section.entries?.length > 0 ? (
                  <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                    {section.entries.map(entry => (
                      <ParticipantBriefingEntry
                        entry={entry}
                        key={entry.key}
                        testId={`event-exhibitor-info-print-preview-${section.key}-${entry.key}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid" style={{ gap: 6, marginTop: 8 }}>
                    {section.lines.map(line => (
                      <p className="muted small" key={line}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="item" data-testid="event-exhibitor-info-print-preview-missing">
              <strong>Noch offen:</strong>
              {preview.missingItems.length > 0 ? (
                <ul className="muted small">
                  {preview.missingItems.map(item => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Alle Pflichtangaben sind hinterlegt.</p>
              )}
            </div>
          </div>
        </div>

        <EventStandPricingPreview
          addonOptions={addonOptions}
          priceTiers={priceTiers}
          standOptions={standOptions}
        />
          </>
        ) : null}
      </div>

      <p className="small muted">Bearbeitung, Versand und PDF folgen später.</p>
    </section>
  )
}
