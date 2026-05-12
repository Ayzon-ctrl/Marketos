import { useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { localAssistantAnswer } from '../../lib/chatUtils'

const MAX_AI_CONTEXT_BYTES = 12 * 1024
const MAX_AI_EVENTS = 5

function normalizeParticipantStatus(participant) {
  return participant?.status || (participant?.paid ? 'bestaetigt' : 'angefragt')
}

function countBy(items, predicate) {
  return items.filter(predicate).length
}

function buildParticipantSummary(participants) {
  const safeParticipants = Array.isArray(participants) ? participants : []

  return {
    total: safeParticipants.length,
    inReview: countBy(safeParticipants, participant => normalizeParticipantStatus(participant) === 'angefragt'),
    confirmed: countBy(safeParticipants, participant => normalizeParticipantStatus(participant) === 'bestaetigt'),
    waitlist: countBy(safeParticipants, participant => normalizeParticipantStatus(participant) === 'warteliste'),
    cancelled: countBy(safeParticipants, participant => normalizeParticipantStatus(participant) === 'abgesagt'),
    paymentOpen: countBy(safeParticipants, participant => !participant?.paid),
    paid: countBy(safeParticipants, participant => Boolean(participant?.paid))
  }
}

function buildTaskSummary(tasks) {
  const safeTasks = Array.isArray(tasks) ? tasks : []
  const now = Date.now()

  return safeTasks.reduce(
    (summary, task) => {
      summary.total += 1
      if (!task?.done) summary.open += 1

      if (task?.due_date && !task?.done) {
        summary.withDueDate += 1
        const dueAt = Date.parse(task.due_date)
        if (!Number.isNaN(dueAt) && dueAt < now) {
          summary.overdue += 1
        }
      }

      return summary
    },
    { total: 0, open: 0, withDueDate: 0, overdue: 0 }
  )
}

function buildEventSummaries(events) {
  const safeEvents = Array.isArray(events) ? events : []

  return [...safeEvents]
    .sort((a, b) => String(a?.event_date || '').localeCompare(String(b?.event_date || '')))
    .slice(0, MAX_AI_EVENTS)
    .map(event => ({
      id: event?.id || '',
      title: event?.title || 'Ohne Eventname',
      event_date: event?.event_date || null,
      public_visible: Boolean(event?.public_visible),
      visibility: event?.public_visible ? 'öffentlich' : 'intern'
    }))
}

function buildStatusCounts(items) {
  const counts = {}
  for (const item of Array.isArray(items) ? items : []) {
    const status = typeof item?.status === 'string' && item.status.trim() ? item.status.trim() : 'unbekannt'
    counts[status] = (counts[status] || 0) + 1
  }
  return counts
}

function trimAiContextSize(aiContext) {
  let nextContext = aiContext
  let bytes = new TextEncoder().encode(JSON.stringify(nextContext)).length

  if (bytes <= MAX_AI_CONTEXT_BYTES) return nextContext

  nextContext = {
    ...nextContext,
    events: nextContext.events.slice(0, 3)
  }
  bytes = new TextEncoder().encode(JSON.stringify(nextContext)).length
  if (bytes <= MAX_AI_CONTEXT_BYTES) return nextContext

  nextContext = {
    roleView: nextContext.roleView,
    profile: nextContext.profile,
    events: nextContext.events.slice(0, 1),
    eventSummary: nextContext.eventSummary,
    participantSummary: nextContext.participantSummary,
    taskSummary: nextContext.taskSummary,
    announcementSummary: { total: nextContext.announcementSummary.total },
    templateSummary: { total: nextContext.templateSummary.total },
    reviewSummary: { total: nextContext.reviewSummary.total },
    contractSummary: { total: nextContext.contractSummary.total }
  }

  return nextContext
}

function buildAiContext({
  profile,
  roleView,
  events,
  participants,
  tasks,
  announcements,
  templates,
  reviews,
  contracts
}) {
  const safeEvents = Array.isArray(events) ? events : []
  const safeAnnouncements = Array.isArray(announcements) ? announcements : []
  const safeTemplates = Array.isArray(templates) ? templates : []
  const safeReviews = Array.isArray(reviews) ? reviews : []
  const safeContracts = Array.isArray(contracts) ? contracts : []

  const aiContext = {
    roleView: roleView || 'organizer',
    profile: {
      role: profile?.role || null,
      profileType: profile?.role || roleView || 'unknown',
      hasDisplayName: Boolean(profile?.display_name || profile?.company_name || profile?.first_name || profile?.last_name)
    },
    eventSummary: {
      total: safeEvents.length,
      publicVisible: countBy(safeEvents, event => Boolean(event?.public_visible)),
      internal: countBy(safeEvents, event => !event?.public_visible)
    },
    events: buildEventSummaries(safeEvents),
    participantSummary: buildParticipantSummary(participants),
    taskSummary: buildTaskSummary(tasks),
    announcementSummary: {
      total: safeAnnouncements.length,
      pinned: countBy(safeAnnouncements, item => Boolean(item?.pinned))
    },
    templateSummary: {
      total: safeTemplates.length
    },
    reviewSummary: {
      total: safeReviews.length
    },
    contractSummary: {
      total: safeContracts.length,
      byStatus: buildStatusCounts(safeContracts)
    }
  }

  return trimAiContextSize(aiContext)
}

export default function ChatAssistantView({
  profile,
  roleView,
  events,
  participants,
  tasks,
  announcements,
  templates,
  reviews,
  contracts
}) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Ich bin dein MarketOS-Assistent. Frag mich nach offenen Zahlungen, kritischen ToDos, nächsten Events oder E-Mail-Vorlagen.'
    }
  ])

  async function sendMessage(event) {
    event.preventDefault()

    const question = input.trim()
    if (!question || busy) return

    const localContext = {
      profile,
      roleView,
      events,
      participants,
      tasks,
      announcements,
      templates,
      reviews,
      contracts
    }

    const aiContext = buildAiContext(localContext)
    const nextMessages = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setInput('')
    setBusy(true)

    let answer = ''

    try {
      const { data, error } = await supabase.functions.invoke('market-ai-chat', {
        body: { question, context: aiContext }
      })
      if (error) throw error

      answer = data?.answer || localAssistantAnswer(question, localContext)
    } catch (_err) {
      answer = localAssistantAnswer(question, localContext)
    }

    setMessages([...nextMessages, { role: 'assistant', content: answer }])
    setBusy(false)
  }

  return (
    <div className="grid two chat-layout">
      <div className="card chat-card">
        <h2>KI Chat</h2>
        <p className="muted">
          Fragt deine aktuellen Dashboard-Daten ab. Wenn die Edge Function aktiv ist, antwortet
          OpenAI. Sonst läuft ein lokaler Assistent.
        </p>
        <div className="chat-window">
          {messages.map((message, index) => (
            <div key={index} className={`chat-message ${message.role}`}>
              <strong>{message.role === 'user' ? 'Du' : 'MarketOS AI'}</strong>
              <p>{message.content}</p>
            </div>
          ))}
        </div>
        <form className="chat-input" onSubmit={sendMessage}>
          <input
            className="input"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Welche Zahlungen sind offen?"
          />
          <button className="btn" disabled={busy}>
            <Send size={16} /> {busy ? 'Denkt...' : 'Senden'}
          </button>
        </form>
      </div>
      <div className="card">
        <h2>Schnellfragen</h2>
        <div className="quick-prompts">
          {[
            'Welche Zahlungen sind offen?',
            'Welche ToDos sind kritisch?',
            'Welche Events stehen als Nächstes an?',
            'Welche E-Mail-Vorlagen habe ich?',
            'Gib mir einen Kurzstatus.'
          ].map(prompt => (
            <button key={prompt} className="btn ghost" onClick={() => setInput(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
