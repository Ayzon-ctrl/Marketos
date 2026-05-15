import {
  BarChart2,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Star,
  Store,
  Users
} from 'lucide-react'

// Analytics-Nav-Item: nur im Organizer-Kontext sichtbar.
// Nicht in appNav / appMoreNav enthalten, damit es nicht automatisch
// fuer alle Non-Visitor-Profile erscheint.
export const analyticsNavItem = {
  key: 'analytics',
  icon: BarChart2,
  label: 'Analytics',
  path: '/app/analytics',
}

export const publicNav = [
  { key: 'home', label: 'Start', path: '/' },
  { key: 'markets', label: 'Märkte', path: '/markets' },
  { key: 'vendors', label: 'Händler', path: '/vendors' },
  { key: 'about', label: 'Über uns', path: '/about' }
]

export const appNav = [
  { key: 'overview', icon: LayoutDashboard, label: 'Übersicht', path: '/app' },
  { key: 'notifications', icon: Bell, label: 'Meine Updates', path: '/app/updates' },
  { key: 'events', icon: CalendarDays, label: 'Events', path: '/app/events' },
  { key: 'participants', icon: Users, label: 'Teilnehmer', path: '/app/participants' },
  { key: 'messages', icon: MessageSquare, label: 'Mitteilungen', path: '/app/messages' },
  { key: 'tasks', icon: CheckCircle2, label: 'ToDos', path: '/app/tasks' },
  { key: 'billing', icon: CreditCard, label: 'Abrechnung', path: '/app/billing' },
  { key: 'vendor-profile', icon: Store, label: 'Händlerprofil', path: '/app/vendor-profile' },
  { key: 'templates', icon: Mail, label: 'E-Mail Vorlagen', path: '/app/templates' },
  { key: 'reviews', icon: Star, label: 'Bewertungen', path: '/app/reviews' },
  { key: 'contracts', icon: FileText, label: 'Verträge', path: '/app/contracts' },
  { key: 'chat', icon: Bot, label: 'KI Chat', path: '/app/chat' }
]

export const appPrimaryNav = appNav.filter(item =>
  ['overview', 'notifications', 'events', 'participants', 'tasks', 'chat'].includes(item.key)
)

export const appMoreNav = appNav.filter(item =>
  ['messages', 'billing', 'vendor-profile', 'templates', 'reviews', 'contracts'].includes(item.key)
)

export const visitorAppNav = [
  { key: 'overview', icon: LayoutDashboard, label: 'Merkliste', path: '/app' },
  { key: 'notifications', icon: Bell, label: 'Meine Updates', path: '/app/updates' }
]

export const mobilePrimaryViews = ['overview', 'notifications', 'events', 'participants', 'tasks', 'chat']

export function getNavItemsForProfile(profile) {
  return profile?.role === 'visitor' ? visitorAppNav : appPrimaryNav
}

export function getMoreNavItemsForProfile(profile) {
  return profile?.role === 'visitor' ? [] : appMoreNav
}

export function getAppPathForView(view, eventId = '') {
  if (view === 'event-detail' && eventId) return `/app/events/${eventId}`
  if (view === 'analytics') return analyticsNavItem.path
  if (view === 'account') return '/app/account'
  const match = [...appNav, ...visitorAppNav].find(item => item.key === view)
  return match?.path || '/app'
}

export function getAppViewFromPathname(pathname) {
  if (/^\/app\/events\/[^/]+/i.test(pathname)) return 'event-detail'
  if (pathname === '/app' || pathname === '/app/') return 'overview'
  if (pathname === '/app/analytics' || pathname === '/app/analytics/') return 'analytics'
  if (pathname === '/app/account' || pathname === '/app/account/') return 'account'
  const match = [...appNav, ...visitorAppNav].find(item => item.path !== '/app' && pathname.startsWith(item.path))
  return match?.key || 'overview'
}
