import { fmtDate } from '../../lib/eventUtils'
import {
  getTaskPriorityClass,
  getTaskPriorityLabel,
  getTaskScopeLabel,
  taskPriorityOptions,
  taskScopeOptions
} from '../../lib/taskUtils'

export default function EventTasksSection({
  taskForm,
  setTaskForm,
  addTask,
  busyTask,
  eventTasks,
  toggleTask,
  taskSchemaReady
}) {
  return (
    <div className="card detail-column" data-testid="event-detail-tasks">
      <h3>ToDos</h3>
      <form className="detail-form" onSubmit={addTask}>
        <input
          className="input"
          data-testid="detail-task-title"
          placeholder="Aufgabe"
          value={taskForm.title}
          onChange={event => setTaskForm({ ...taskForm, title: event.target.value })}
        />
        <input
          className="input"
          data-testid="detail-task-date"
          type="date"
          value={taskForm.due_date}
          onChange={event => setTaskForm({ ...taskForm, due_date: event.target.value })}
        />
        <select
          className="input"
          data-testid="detail-task-priority"
          value={taskForm.priority}
          onChange={event => setTaskForm({ ...taskForm, priority: event.target.value })}
        >
          {taskPriorityOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          className="input"
          data-testid="detail-task-scope"
          value={taskForm.scope}
          onChange={event => setTaskForm({ ...taskForm, scope: event.target.value })}
        >
          {taskScopeOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="btn" data-testid="detail-save-task" disabled={busyTask}>
          {busyTask ? 'Speichert...' : 'ToDo speichern'}
        </button>
      </form>
      {!taskSchemaReady && (
        <p className="field-hint">
          Priorität und Team-/Eigene-Zuordnung laufen aktuell lokal im Browser, bis die SQL-Datei für `tasks` ausgeführt wurde.
        </p>
      )}
      <div className="list detail-list">
        {eventTasks.length === 0 && <p className="muted">Noch keine ToDos für dieses Event.</p>}
        {eventTasks.map(task => (
          <div className="item row space-between" key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <div className="row">
                <span className={getTaskPriorityClass(task.priority)}>{getTaskPriorityLabel(task.priority)}</span>
                <span className="pill">{getTaskScopeLabel(task.scope)}</span>
              </div>
              <p className="muted">{fmtDate(task.due_date)}</p>
            </div>
            <button
              className="btn secondary"
              data-testid="detail-toggle-task"
              type="button"
              onClick={() => toggleTask(task)}
            >
              {task.done ? 'Erledigt' : 'Offen'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
