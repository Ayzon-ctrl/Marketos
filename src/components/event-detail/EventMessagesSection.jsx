export default function EventMessagesSection({
  messageForm,
  setMessageForm,
  addMessage,
  busyMessage,
  eventAnnouncements
}) {
  return (
    <div className="card detail-column" data-testid="event-detail-messages">
      <h3>Mitteilungen</h3>
      <form className="detail-form" onSubmit={addMessage}>
        <input
          className="input"
          data-testid="detail-message-title"
          placeholder="Titel"
          value={messageForm.title}
          onChange={event => setMessageForm({ ...messageForm, title: event.target.value })}
        />
        <textarea
          className="input"
          data-testid="detail-message-body"
          placeholder="Nachricht"
          value={messageForm.body}
          onChange={event => setMessageForm({ ...messageForm, body: event.target.value })}
        />
        <label className="row">
          <input
            type="checkbox"
            checked={messageForm.pinned}
            onChange={event => setMessageForm({ ...messageForm, pinned: event.target.checked })}
          />{' '}
          Anpinnen
        </label>
        <button className="btn" data-testid="detail-save-message" disabled={busyMessage}>
          {busyMessage ? 'Speichert...' : 'Mitteilung senden'}
        </button>
      </form>
      <div className="list detail-list">
        {eventAnnouncements.length === 0 && (
          <p className="muted">Noch keine Mitteilungen für dieses Event.</p>
        )}
        {eventAnnouncements.map(item => (
          <div className="item" key={item.id}>
            <strong>{item.title}</strong>
            {item.pinned && <span className="pill ok">Angepinnt</span>}
            <p className="muted">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
