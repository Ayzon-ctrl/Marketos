import AccountView from './views/AccountView'
import AnalyticsView from './views/AnalyticsView'
import AnnouncementsView from './views/AnnouncementsView'
import BillingView from './views/BillingView'
import ChatAssistantView from './views/ChatAssistantView'
import ContractsView from './views/ContractsView'
import EventDetailView from './views/EventDetailView'
import EventsView from './views/EventsView'
import NotificationsView from './views/NotificationsView'
import OverviewView from './views/OverviewView'
import ParticipantsView from './views/ParticipantsView'
import ReviewsView from './views/ReviewsView'
import TasksView from './views/TasksView'
import TemplatesView from './views/TemplatesView'
import VendorProfileView from './views/VendorProfileView'
import VisitorOverviewView from './views/VisitorOverviewView'

export default function ContentRouter(props) {
  // Konto-Seite ist für alle Rollen zugänglich
  if (props.active === 'account') return <AccountView {...props} />

  if (props.profile?.role === 'visitor') {
    if (props.active === 'notifications') return <NotificationsView {...props} />
    return <VisitorOverviewView {...props} />
  }

  if (props.active === 'analytics') return <AnalyticsView {...props} />
  if (props.active === 'event-detail') return <EventDetailView {...props} />
  if (props.active === 'notifications') return <NotificationsView {...props} />
  if (props.active === 'events') return <EventsView {...props} />
  if (props.active === 'participants') return <ParticipantsView {...props} />
  if (props.active === 'messages') return <AnnouncementsView {...props} />
  if (props.active === 'tasks') return <TasksView {...props} />
  if (props.active === 'billing') return <BillingView {...props} />
  if (props.active === 'vendor-profile') return <VendorProfileView {...props} />
  if (props.active === 'templates') return <TemplatesView {...props} />
  if (props.active === 'reviews') return <ReviewsView {...props} />
  if (props.active === 'contracts') return <ContractsView {...props} />
  if (props.active === 'chat') return <ChatAssistantView {...props} />
  return <OverviewView {...props} />
}
