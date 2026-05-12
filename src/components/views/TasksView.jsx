import { useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { fmtDate } from '../../lib/eventUtils'
import { getUserErrorMessage } from '../../lib/userError'
import {
  getTaskPriorityClass,
  getTaskPriorityLabel,
  getTaskScopeLabel,
  persistTaskMeta,
  taskPriorityOptions,
  taskScopeOptions
} from '../../lib/taskUtils'

export default function TasksView({ tasks, events, profile, reload, notify, taskSchemaReady }) {
  const [form, setForm] = useState({
    title: '',
    due_date: '',
    event_id: '',
    priority: 'medium',
    scope: 'own'
  })
  const [scopeFilter, setScopeFilter] = useState('all')

  const filteredTasks = useMemo(() => {
    if (scopeFilter === 'all') return tasks
    return tasks.filter(task => (task.scope || 'own') === scopeFilter)
  }, [scopeFilter, tasks])

  async function addTask(event) {
    event.preventDefault()
    try {
      const payload = {
        due_date: form.due_date || null,
        event_id: form.event_id || null,
        owner_id: profile.id,
        title: form.title,
        ...(taskSchemaReady ? { priority: form.priority, scope: form.scope } : {})
      }
      const { data, error } = await supabase.from('tasks').insert(payload).select().single()
      if (error) throw error
      if (!taskSchemaReady && data?.id) {
        persistTaskMeta(data.id, { priority: form.priority, scope: form.scope })
      }

      setForm({ title: '', due_date: '', event_id: '', priority: 'medium', scope: 'own' })
      await reload()
      notify?.('success', 'ToDo gespeichert.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'ToDo konnte nicht gespeichert werden.'))
    }
  }

  async function toggleTask(task) {
    try {
      const { error } = await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)
      if (error) throw error

      await reload()
      notify?.('success', 'ToDo aktualisiert.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'ToDo konnte nicht aktualisiert werden.'))
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <h2>ToDo erstellen</h2>
        <form onSubmit={addTask} className="grid">
          <input
            className="input"
            required
            placeholder="Aufgabe"
            value={form.title}
            onChange={event => setForm({ ...form, title: event.target.value })}
          />
          <input
            className="input"
            type="date"
            value={form.due_date}
            onChange={event => setForm({ ...form, due_date: event.target.value })}
          />
          <select
            value={form.event_id}
            onChange={event => setForm({ ...form, event_id: event.target.value })}
          >
            <option value="">Ohne Event</option>
            {events.map(eventItem => (
              <option key={eventItem.id} value={eventItem.id}>
                {eventItem.title}
              </option>
            ))}
          </select>
          <select
            data-testid="tasks-priority"
            value={form.priority}
            onChange={event => setForm({ ...form, priority: event.target.value })}
          >
            {taskPriorityOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            data-testid="tasks-scope"
            value={form.scope}
            onChange={event => setForm({ ...form, scope: event.target.value })}
          >
            {taskScopeOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="btn">Speichern</button>
        </form>
        {!taskSchemaReady && (
          <p className="field-hint">
            Priorität und Team-/Eigene-Zuordnung laufen aktuell lokal im Browser, bis die SQL-Datei für `tasks` ausgeführt wurde.
          </p>
        )}
      </div>
      <div className="card">
        <h2>ToDos</h2>
        <div className="tabs task-scope-tabs" data-testid="tasks-scope-filters">
          <button
            type="button"
            className={scopeFilter === 'all' ? 'active' : ''}
            onClick={() => setScopeFilter('all')}
          >
            Alle
          </button>
          <button
            type="button"
            className={scopeFilter === 'own' ? 'active' : ''}
            onClick={() => setScopeFilter('own')}
          >
            Eigene
          </button>
          <button
            type="button"
            className={scopeFilter === 'team' ? 'active' : ''}
            onClick={() => setScopeFilter('team')}
          >
            Team
          </button>
        </div>
        <div className="list">
          {filteredTasks.map(task => (
            <div className="item row space-between" data-testid="task-item" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <div className="row">
                  <span className={getTaskPriorityClass(task.priority)}>{getTaskPriorityLabel(task.priority)}</span>
                  <span className="pill">{getTaskScopeLabel(task.scope)}</span>
                </div>
                <p className="muted">{fmtDate(task.due_date)}</p>
              </div>
              <button className="btn secondary" onClick={() => toggleTask(task)}>
                {task.done ? 'Erledigt' : 'Offen'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
