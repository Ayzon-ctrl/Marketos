import {
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  MoreHorizontal,
  Users
} from 'lucide-react'

export default function MobileBottomNav({ activeView, isVisitor = false, moreOpen = false, setActiveView }) {
  const items = isVisitor
    ? [
        { key: 'overview', target: 'overview', label: 'Merkliste', icon: LayoutDashboard },
        { key: 'notifications', target: 'notifications', label: 'Updates', icon: Bell }
      ]
    : [
        { key: 'overview', target: 'overview', label: 'Übersicht', icon: LayoutDashboard },
        { key: 'events', target: 'events', label: 'Events', icon: CalendarDays },
        { key: 'participants', target: 'participants', label: 'Teilnehmer', icon: Users },
        { key: 'tasks', target: 'tasks', label: 'ToDos', icon: CheckCircle2 },
        { key: 'chat', target: 'chat', label: 'KI Chat', icon: Bot },
        { key: 'more', target: 'more', label: 'Mehr', icon: MoreHorizontal }
      ]

  return (
    <nav
      className="mobile-bottom-nav"
      data-testid="mobile-bottom-nav"
      style={{ '--mobile-nav-columns': String(items.length) }}
    >
      {items.map(item => {
        const Icon = item.icon
        const active = item.key === 'more' ? moreOpen : activeView === item.key

        return (
          <button
            key={item.key}
            className={`mobile-nav-item ${active ? 'active' : ''}`}
            data-testid={`mobile-nav-${item.key}`}
            onClick={() => setActiveView(item.target)}
            type="button"
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
