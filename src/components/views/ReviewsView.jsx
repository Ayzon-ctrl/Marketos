import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { getUserErrorMessage } from '../../lib/userError'

export default function ReviewsView({ reviews, events, reload, notify }) {
  const [form, setForm] = useState({
    event_id: '',
    organization_score: 5,
    visitors_score: 5,
    infrastructure_score: 5,
    comment: ''
  })

  async function addReview(event) {
    event.preventDefault()

    try {
      const user = (await supabase.auth.getUser()).data.user
      const { error } = await supabase.from('reviews').insert({
        ...form,
        event_id: form.event_id || null,
        reviewer_id: user.id,
        anonymous_public: true
      })

      if (error) throw error

      setForm({
        event_id: '',
        organization_score: 5,
        visitors_score: 5,
        infrastructure_score: 5,
        comment: ''
      })
      await reload()
      notify?.('success', 'Bewertung gespeichert.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Bewertung konnte nicht gespeichert werden.'))
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <h2>Event bewerten</h2>
        <p className="muted">
          Funktioniert nur, wenn du als Teilnehmer beim Event hinterlegt bist. Genau so soll es
          sein, Fake-Bewertungen braucht niemand außer sehr traurigen Marketingabteilungen.
        </p>
        <form onSubmit={addReview} className="grid">
          <select
            required
            value={form.event_id}
            onChange={event => setForm({ ...form, event_id: event.target.value })}
          >
            <option value="">Event wählen</option>
            {events.map(eventItem => (
              <option key={eventItem.id} value={eventItem.id}>
                {eventItem.title}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            min="1"
            max="5"
            value={form.organization_score}
            onChange={event => setForm({ ...form, organization_score: Number(event.target.value) })}
          />
          <input
            className="input"
            type="number"
            min="1"
            max="5"
            value={form.visitors_score}
            onChange={event => setForm({ ...form, visitors_score: Number(event.target.value) })}
          />
          <input
            className="input"
            type="number"
            min="1"
            max="5"
            value={form.infrastructure_score}
            onChange={event => setForm({ ...form, infrastructure_score: Number(event.target.value) })}
          />
          <textarea
            placeholder="Kommentar"
            value={form.comment}
            onChange={event => setForm({ ...form, comment: event.target.value })}
          />
          <button className="btn">Bewertung speichern</button>
        </form>
      </div>
      <div className="card">
        <h2>Bewertungen</h2>
        <div className="list">
          {reviews.map(review => (
            <div className="item" key={review.id}>
              <strong>
                Ø {((review.organization_score + review.visitors_score + review.infrastructure_score) / 3).toFixed(1)} Sterne
              </strong>
              <p className="muted">
                Orga {review.organization_score}/5 · Besucher {review.visitors_score}/5 · Infrastruktur{' '}
                {review.infrastructure_score}/5
              </p>
              <p>{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
