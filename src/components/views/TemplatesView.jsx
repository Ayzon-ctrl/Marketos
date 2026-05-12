import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { getUserErrorMessage } from '../../lib/userError'

export default function TemplatesView({ templates, profile, reload, notify }) {
  const [form, setForm] = useState({
    name: '',
    subject: '',
    body: '',
    send_offset_days: 2
  })

  async function addTemplate(event) {
    event.preventDefault()

    try {
      const { error } = await supabase.from('email_templates').insert({
        ...form,
        owner_id: profile.id,
        active: true
      })
      if (error) throw error

      setForm({ name: '', subject: '', body: '', send_offset_days: 2 })
      await reload()
      notify?.('success', 'E-Mail-Vorlage gespeichert.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Vorlage konnte nicht gespeichert werden.'))
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <h2>E-Mail Vorlage</h2>
        <form onSubmit={addTemplate} className="grid">
          <input
            className="input"
            required
            placeholder="Name"
            value={form.name}
            onChange={event => setForm({ ...form, name: event.target.value })}
          />
          <input
            className="input"
            required
            placeholder="Betreff"
            value={form.subject}
            onChange={event => setForm({ ...form, subject: event.target.value })}
          />
          <textarea
            required
            placeholder="Text mit Variablen wie {{name}} und {{event_name}}"
            value={form.body}
            onChange={event => setForm({ ...form, body: event.target.value })}
          />
          <input
            className="input"
            type="number"
            value={form.send_offset_days}
            onChange={event => setForm({ ...form, send_offset_days: Number(event.target.value) })}
          />
          <button className="btn">Vorlage speichern</button>
        </form>
      </div>
      <div className="card">
        <h2>Vorlagen</h2>
        <div className="list">
          {templates.map(template => (
            <div className="item" key={template.id}>
              <strong>{template.name}</strong>
              <p className="muted">{template.subject}</p>
              <span className="pill">{template.send_offset_days} Tage vorher</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
