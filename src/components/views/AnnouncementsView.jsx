import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { getUserErrorMessage } from '../../lib/userError'

export default function AnnouncementsView({ announcements, events, profile, reload, notify }) {
  const [form, setForm] = useState({ event_id: '', title: '', body: '', pinned: false })

  async function addAnnouncement(event) {
    event.preventDefault()

    try {
      const { error } = await supabase.from('announcements').insert({
        ...form,
        event_id: form.event_id || null,
        author_id: profile.id
      })
      if (error) throw error

      setForm({ event_id: '', title: '', body: '', pinned: false })
      await reload()
      notify?.('success', 'Mitteilung veröffentlicht.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Mitteilung konnte nicht gespeichert werden.'))
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <h2>Mitteilung posten</h2>
        <form onSubmit={addAnnouncement} className="grid">
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
            required
            placeholder="Titel"
            value={form.title}
            onChange={event => setForm({ ...form, title: event.target.value })}
          />
          <textarea
            required
            placeholder="Nachricht"
            value={form.body}
            onChange={event => setForm({ ...form, body: event.target.value })}
          />
          <label className="row">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={event => setForm({ ...form, pinned: event.target.checked })}
            />{' '}
            Anpinnen
          </label>
          <button className="btn">Veröffentlichen</button>
        </form>
      </div>
      <div className="card">
        <h2>Mitteilungen</h2>
        <div className="list">
          {announcements.map(announcement => (
            <div className="item" key={announcement.id}>
              <strong>{announcement.title}</strong>{' '}
              {announcement.pinned && <span className="pill ok">Angepinnt</span>}
              <p className="muted">{announcement.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
