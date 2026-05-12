import { useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { getUserErrorMessage } from '../../lib/userError'

export default function NotificationsView({ notifications, notify, reload }) {
  const [busyId, setBusyId] = useState('')
  const unreadCount = useMemo(
    () => notifications.filter(item => !item.read_at).length,
    [notifications]
  )

  async function markAsRead(notification) {
    if (!notification?.id || notification.read_at) return
    setBusyId(notification.id)
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification.id)
      if (error) throw error
      await reload()
      notify?.('success', 'Update als gelesen markiert.')
    } catch (error) {
      notify?.('error', getUserErrorMessage(error, 'Update konnte nicht aktualisiert werden.'))
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="grid" data-testid="notifications-view">
      <div className="card">
        <div className="row space-between">
          <div>
            <h2>Meine Updates</h2>
            <p className="muted">
              Alle internen Hinweise zu deinen gespeicherten Märkten und Händlern an einem Ort.
            </p>
          </div>
          <span className={`pill ${unreadCount > 0 ? 'warn' : 'ok'}`}>
            {unreadCount} ungelesen
          </span>
        </div>

        <div className="list">
          {notifications.length === 0 && (
            <div className="item" data-testid="notifications-empty">
              <strong>Noch keine Updates vorhanden.</strong>
              <p className="muted">Sobald ein gespeicherter Markt oder Händler ein Update postet, taucht es hier auf.</p>
            </div>
          )}

          {notifications.map(notification => (
            <div
              className={`item notification-item ${notification.read_at ? 'read' : 'unread'}`}
              data-testid="notification-item"
              key={notification.id}
            >
              <div>
                <strong>{notification.title}</strong>
                <p className="muted">{notification.body}</p>
              </div>
              {!notification.read_at ? (
                <button
                  className="btn ghost"
                  data-testid="notification-mark-read"
                  disabled={busyId === notification.id}
                  onClick={() => markAsRead(notification)}
                  type="button"
                >
                  <Bell size={16} /> {busyId === notification.id ? 'Speichert...' : 'Als gelesen markieren'}
                </button>
              ) : (
                <span className="pill ok">Gelesen</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
