import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Bookmark, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Euro, LogOut, Palette, Store, Users } from 'lucide-react'
import { supabase } from '../supabaseClient'
import MobileBottomNav from './MobileBottomNav'
import ContentRouter from './ContentRouter'
import StyleGuideModal from './StyleGuideModal'
import {
  analyticsNavItem,
  getAppPathForView,
  getAppViewFromPathname,
  getMoreNavItemsForProfile,
  getNavItemsForProfile
} from '../lib/navigation'
import { getGreeting, getProfileName, validateEvents } from '../lib/eventUtils'
import { trackEvent } from '../lib/analytics'
import {
  backgroundThemes,
  buildThemeStyle,
  loadThemePrefs,
  saveThemePrefs,
  sidebarThemes
} from '../lib/themeUtils'
import {
  loadDashboardData,
  saveProfileDisplayName,
  saveStyleGuideSeen,
  seedDemoData
} from '../lib/dashboardData'
import { getUserErrorMessage } from '../lib/userError'

function loadRoleViewPreference() {
  if (typeof window === 'undefined') return ''
  const stored = window.localStorage.getItem('marketos-role-view')
  return stored === 'exhibitor' || stored === 'organizer' ? stored : ''
}

function saveRoleViewPreference(roleView) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('marketos-role-view', roleView)
}

function getAllowedRoleViews(profile) {
  if (!profile) return ['organizer']
  if (profile.role === 'both') return ['organizer', 'exhibitor']
  if (profile.role === 'exhibitor') return ['exhibitor']
  if (profile.role === 'visitor') return []
  return ['organizer']
}

function resolveRoleViewForProfile(profile, preferredRoleView = '') {
  const allowedRoleViews = getAllowedRoleViews(profile)

  if (allowedRoleViews.length === 0) return 'organizer'
  if (allowedRoleViews.includes(preferredRoleView)) return preferredRoleView
  if (allowedRoleViews.includes('organizer')) return 'organizer'
  return allowedRoleViews[0]
}

function getSelectedEventIdFromPathname(pathname) {
  const match = pathname.match(/^\/app\/events\/([^/]+)/i)
  return match?.[1] || ''
}

function buildMobileMoreGroups({
  active,
  canSwitchRoleView,
  moreNavItems,
  openMoreView,
  openStyleGuide,
  profile,
  roleView,
  signOut,
  styleGuideOpen,
  switchRoleView
}) {
  const byKey = new Map((moreNavItems || []).map(item => [item.key, item]))
  const buildButtonItem = (item, testId) => ({
    key: item.key,
    label: item.label,
    active: active === item.key,
    onClick: () => openMoreView(item.key),
    testId
  })

  const communicationItems = []
  communicationItems.push({
    key: 'notifications',
    label: 'Updates',
    active: active === 'notifications',
    onClick: () => openMoreView('notifications'),
    testId: 'mobile-more-notifications'
  })
  if (byKey.has('messages')) {
    communicationItems.push(buildButtonItem(byKey.get('messages'), 'mobile-more-messages'))
  }

  const organizationItems = ['billing', 'templates', 'reviews', 'contracts']
    .filter(key => byKey.has(key))
    .map(key => buildButtonItem(byKey.get(key), `mobile-more-${key}`))

  const profileToolItems = []
  if (byKey.has('vendor-profile')) {
    profileToolItems.push(buildButtonItem(byKey.get('vendor-profile'), 'mobile-more-vendor-profile'))
  }
  profileToolItems.push({
    key: 'style-guide',
    label: 'Style Guide',
    active: styleGuideOpen,
    onClick: openStyleGuide,
    testId: 'mobile-open-style-guide'
  })

  const accountItems = []
  if (canSwitchRoleView) {
    accountItems.push({
      key: 'role-organizer',
      label: 'Veranstalter',
      active: roleView === 'organizer',
      onClick: () => switchRoleView('organizer'),
      testId: 'mobile-role-view-organizer'
    })
    accountItems.push({
      key: 'role-exhibitor',
      label: 'Aussteller',
      active: roleView === 'exhibitor',
      onClick: () => switchRoleView('exhibitor'),
      testId: 'mobile-role-view-exhibitor'
    })
  }
  accountItems.push({
    key: 'logout',
    label: 'Abmelden',
    active: false,
    onClick: signOut,
    tone: 'danger',
    testId: 'mobile-logout-button'
  })

  return [
    {
      key: 'communication',
      title: 'Kommunikation',
      items: communicationItems
    },
    {
      key: 'organization',
      title: 'Organisation',
      items: organizationItems
    },
    {
      key: 'profile-tools',
      title: 'Profil & Tools',
      items: profileToolItems
    },
    ...(profile?.is_admin === true
      ? [{
          key: 'admin',
          title: 'Admin',
          items: [{
            key: analyticsNavItem.key,
            label: analyticsNavItem.label,
            active: active === analyticsNavItem.key,
            onClick: () => openMoreView(analyticsNavItem.key),
            testId: 'mobile-more-analytics'
          }]
        }]
      : []),
    {
      key: 'account-view',
      title: canSwitchRoleView ? 'Konto & Ansicht' : 'Konto',
      items: accountItems
    }
  ].filter(group => group.items.length > 0)
}

export default function ProtectedAppShell({ session }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isLocalDevHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  const showDemoSeedButton = import.meta.env.DEV === true && isLocalDevHost
  const [profile, setProfile] = useState(null)
  const [roleView, setRoleView] = useState(() => loadRoleViewPreference() || 'organizer')
  const [events, setEvents] = useState([])
  const [participants, setParticipants] = useState([])
  const [tasks, setTasks] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [templates, setTemplates] = useState([])
  const [reviews, setReviews] = useState([])
  const [contracts, setContracts] = useState([])
  const [locations, setLocations] = useState([])
  const [exhibitorEvents, setExhibitorEvents] = useState([])
  const [exhibitorParticipants, setExhibitorParticipants] = useState([])
  const [exhibitorAnnouncements, setExhibitorAnnouncements] = useState([])
  const [vendorProfile, setVendorProfile] = useState(null)
  const [vendorImages, setVendorImages] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [linkableVendors, setLinkableVendors] = useState([])
  const [publicUpdates, setPublicUpdates] = useState([])
  const [notifications, setNotifications] = useState([])
  const [favoriteEvents, setFavoriteEvents] = useState([])
  const [favoriteVendors, setFavoriteVendors] = useState([])
  const [taskSchemaReady, setTaskSchemaReady] = useState(false)
  const [themePrefs, setThemePrefs] = useState(() => loadThemePrefs())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [profileNameDraft, setProfileNameDraft] = useState('')
  const [savingProfileName, setSavingProfileName] = useState(false)
  const [savingStyleGuide, setSavingStyleGuide] = useState(false)
  const [styleGuideOpen, setStyleGuideOpen] = useState(false)
  const [styleGuideMode, setStyleGuideMode] = useState('manual')
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [participantViewFilter, setParticipantViewFilter] = useState('alle')
  const [participantViewEventId, setParticipantViewEventId] = useState('')
  const [eventEditIntent, setEventEditIntent] = useState(null)
  const toastTimerRef = useRef(null)
  const hasTrackedAppEntryRef = useRef(false)
  const lastTrackedDashboardRoleRef = useRef(null)

  const active = useMemo(() => getAppViewFromPathname(location.pathname), [location.pathname])
  const selectedEventId = useMemo(() => getSelectedEventIdFromPathname(location.pathname), [location.pathname])
  const isVisitorProfile = profile?.role === 'visitor'
  const allowedRoleViews = useMemo(() => getAllowedRoleViews(profile), [profile])
  const canSwitchRoleView = allowedRoleViews.length > 1
  const navItems = useMemo(() => getNavItemsForProfile(profile), [profile])
  const moreNavItems = useMemo(() => getMoreNavItemsForProfile(profile), [profile])
  const isMoreViewActive = useMemo(
    () => moreNavItems.some(item => item.key === active) || active === 'analytics' || styleGuideOpen,
    [active, moreNavItems, styleGuideOpen]
  )

  useEffect(() => {
    if (isMoreViewActive) {
      setDesktopMoreOpen(true)
    }
  }, [isMoreViewActive])

  const notify = useCallback((type, message) => {
    setToast({ type, message })
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500)
  }, [])

  const loadAll = useCallback(async () => {
    setError('')
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
        return
      }

      const data = await loadDashboardData(authData.user)
      const preferredRoleView = loadRoleViewPreference()
      const defaultRoleView = data.roleView === 'exhibitor' ? 'exhibitor' : 'organizer'
      const nextRoleView = resolveRoleViewForProfile(data.profile, preferredRoleView || defaultRoleView)

      setProfile(data.profile)
      setProfileNameDraft(data.profileNameDraft)
      setRoleView(nextRoleView)
      if (data.profile?.role !== 'visitor') {
        saveRoleViewPreference(nextRoleView)
      }
      setEvents(data.events)
      setParticipants(data.participants)
      setTasks(data.tasks)
      setAnnouncements(data.announcements)
      setTemplates(data.templates)
      setReviews(data.reviews)
      setContracts(data.contracts)
      setLocations(data.locations)
      setExhibitorEvents(data.exhibitorEvents)
      setExhibitorParticipants(data.exhibitorParticipants)
      setExhibitorAnnouncements(data.exhibitorAnnouncements)
      setVendorProfile(data.vendorProfile)
      setVendorImages(data.vendorImages)
      setSubscription(data.subscription)
      setLinkableVendors(data.linkableVendors || [])
      setPublicUpdates(data.publicUpdates)
      setNotifications(data.notifications)
      setFavoriteEvents(data.favoriteEvents)
      setFavoriteVendors(data.favoriteVendors)
      setTaskSchemaReady(Boolean(data.taskSchemaReady))

      // app_entry – einmalig pro Session, nachdem Auth + Daten erfolgreich geladen sind.
      if (!hasTrackedAppEntryRef.current) {
        hasTrackedAppEntryRef.current = true
        const entryRole = data.profile?.role === 'visitor'
          ? 'visitor'
          : nextRoleView
        trackEvent(supabase, {
          event_name: 'app_entry',
          area: 'dashboard',
          role_context: entryRole,
          route: location.pathname,
        })
      }
    } catch (err) {
      setError(getUserErrorMessage(err, 'Fehler beim Laden.'))
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAll()
    }, 50)

    return () => window.clearTimeout(timer)
  }, [loadAll, session])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isVisitorProfile) return
    if (active === 'overview' || active === 'notifications') return
    navigate('/app', { replace: true })
  }, [active, isVisitorProfile, navigate])

  useEffect(() => {
    if (!profile || profile.role === 'visitor') return

    const storedRoleView = loadRoleViewPreference()
    const resolvedRoleView = resolveRoleViewForProfile(profile, storedRoleView || roleView)

    if (storedRoleView !== resolvedRoleView) {
      saveRoleViewPreference(resolvedRoleView)
    }

    if (roleView !== resolvedRoleView) {
      setRoleView(resolvedRoleView)
    }
  }, [profile, roleView])

  // dashboard_loaded – feuert wenn Overview-View aktiv und Daten geladen sind.
  // Ref verhindert Doppel-Tracking fuer denselben role_context ohne echten Rollenwechsel.
  const effectiveRoleContext = isVisitorProfile ? 'visitor' : roleView
  useEffect(() => {
    if (loading || active !== 'overview') return
    if (lastTrackedDashboardRoleRef.current === effectiveRoleContext) return
    lastTrackedDashboardRoleRef.current = effectiveRoleContext
    trackEvent(supabase, {
      event_name: 'dashboard_loaded',
      area: 'dashboard',
      role_context: effectiveRoleContext,
    })
  }, [active, loading, effectiveRoleContext])

  const profileName = useMemo(() => {
    if (!profile) return ''

    const resolvedName = getProfileName(profile, '')
    return resolvedName || 'Account'
  }, [profile])
  const needsProfileName = Boolean(profile && !String(profile.display_name || '').trim())

  useEffect(() => {
    if (!profile || needsProfileName) return
    if (profile.has_seen_style_guide) return
    setStyleGuideMode('onboarding')
    setStyleGuideOpen(true)
  }, [needsProfileName, profile])

  const saveProfileName = useCallback(
    async event => {
      event.preventDefault()
      if (!profile || savingProfileName) return

      const displayName = profileNameDraft.trim()
      if (!displayName) {
        notify('error', 'Bitte gib einen Anzeigenamen ein.')
        return
      }

      setSavingProfileName(true)
      try {
        const data = await saveProfileDisplayName(profile.id, displayName)
        setProfile(data)
        notify('success', 'Name gespeichert.')
      } catch (err) {
        notify('error', getUserErrorMessage(err, 'Name konnte nicht gespeichert werden.'))
      } finally {
        setSavingProfileName(false)
      }
    },
    [notify, profile, profileNameDraft, savingProfileName]
  )

  const seedDemo = useCallback(async () => {
    if (!profile) return

    setError('')
    try {
      await seedDemoData({
        profile,
        locations,
        sessionEmail: session?.user?.email || null
      })
      await loadAll()
    } catch (err) {
      setError(getUserErrorMessage(err, 'Demo konnte nicht erstellt werden.'))
    }
  }, [loadAll, locations, profile, session])

  const openStyleGuide = useCallback(() => {
    setStyleGuideMode('manual')
    setDesktopMoreOpen(true)
    setMobileMoreOpen(true)
    setStyleGuideOpen(true)
  }, [])

  const closeStyleGuide = useCallback(() => {
    if (styleGuideMode === 'onboarding') return
    setStyleGuideOpen(false)
  }, [styleGuideMode])

  const saveStyleGuide = useCallback(async () => {
    if (!profile || savingStyleGuide) return

    setSavingStyleGuide(true)
    try {
      const updatedProfile = await saveStyleGuideSeen(profile.id)
      setProfile(updatedProfile)
      setStyleGuideOpen(false)
      setStyleGuideMode('manual')
      notify('success', 'Style Guide gespeichert')
    } catch (err) {
      notify('error', getUserErrorMessage(err, 'Style Guide konnte nicht gespeichert werden.'))
    } finally {
      setSavingStyleGuide(false)
    }
  }, [notify, profile, savingStyleGuide])

  const stats = useMemo(() => {
    if (isVisitorProfile) {
      const unreadCount = notifications.filter(item => !item.read_at).length

      return [
        { icon: Bookmark, label: 'Gespeicherte Märkte', value: favoriteEvents.length },
        { icon: Store, label: 'Gespeicherte Händler', value: favoriteVendors.length },
        { icon: Bell, label: 'Ungelesene Updates', value: unreadCount },
        { icon: CalendarDays, label: 'Kommende Favoriten', value: favoriteEvents.length }
      ]
    }

    if (roleView === 'exhibitor') {
      return [
        { icon: CalendarDays, label: 'Meine Events', value: exhibitorEvents.length },
        {
          icon: Users,
          label: 'Bestätigt',
          value: exhibitorParticipants.filter(
            participant => (participant.status || (participant.paid ? 'bestaetigt' : 'angefragt')) === 'bestaetigt'
          ).length
        },
        {
          icon: Euro,
          label: 'Offen',
          value: exhibitorParticipants.filter(participant => !participant.paid).length
        },
        {
          icon: CheckCircle2,
          label: 'Hinweise',
          value: exhibitorAnnouncements.filter(item => item.pinned).length
        }
      ]
    }

    return [
      { icon: CalendarDays, label: 'Events', value: events.length },
      { icon: Users, label: 'Teilnehmer', value: participants.length },
      { icon: Euro, label: 'Offene Zahlungen', value: participants.filter(participant => !participant.paid).length },
      { icon: CheckCircle2, label: 'Offene ToDos', value: tasks.filter(task => !task.done).length }
    ]
  }, [
    events,
    exhibitorAnnouncements,
    exhibitorEvents,
    exhibitorParticipants,
    favoriteEvents.length,
    favoriteVendors.length,
    isVisitorProfile,
    notifications,
    participants,
    roleView,
    tasks
  ])

  const eventIssues = useMemo(() => validateEvents(events, locations), [events, locations])
  const roleLabel = isVisitorProfile ? 'Besucherbereich' : roleView === 'organizer' ? 'Veranstalter Dashboard' : 'Aussteller Dashboard'
  const topbarTitle = loading ? getGreeting() : profileName ? `${getGreeting()} ${profileName}` : 'Willkommen zurück'
  const topbarSubtitle = loading ? 'Profil wird geladen ...' : roleLabel
  const themeStyle = useMemo(() => buildThemeStyle(themePrefs), [themePrefs])
  const selectedEvent = useMemo(
    () => events.find(event => event.id === selectedEventId) || null,
    [events, selectedEventId]
  )

  const openEventDetail = useCallback(
    event => {
      navigate(getAppPathForView('event-detail', event.id))
    },
    [navigate]
  )

  const closeEventDetail = useCallback(() => {
    navigate(getAppPathForView('events'))
  }, [navigate])

  const openEventEditor = useCallback(
    eventToEdit => {
      const eventId = typeof eventToEdit === 'string' ? eventToEdit : eventToEdit?.id || ''
      setEventEditIntent(
        eventId
          ? {
              id: eventId,
              event: typeof eventToEdit === 'string' ? null : eventToEdit,
              requestedAt: Date.now()
            }
          : null
      )
      navigate(getAppPathForView('events'), { state: { editEventId: eventId || '' } })
    },
    [navigate]
  )

  const openView = useCallback(
    view => {
      navigate(getAppPathForView(view))
    },
    [navigate]
  )

  const openMoreView = useCallback(
    view => {
      setDesktopMoreOpen(true)
      setMobileMoreOpen(false)
      navigate(getAppPathForView(view))
    },
    [navigate]
  )

  const openParticipantsView = useCallback(
    (filter = 'alle', eventId = '') => {
      setParticipantViewFilter(filter)
      setParticipantViewEventId(eventId)
      navigate(getAppPathForView('participants'))
    },
    [navigate]
  )

  const switchRoleView = useCallback(
    nextRoleView => {
      if (!allowedRoleViews.includes(nextRoleView)) return

      trackEvent(supabase, {
        event_name: 'role_switched',
        area: 'dashboard',
        metadata: { role_from: roleView, role_to: nextRoleView },
      })
      saveRoleViewPreference(nextRoleView)
      setRoleView(nextRoleView)
      setMobileMoreOpen(false)
      navigate('/app')
    },
    [allowedRoleViews, navigate, roleView]
  )

  const handlePrimaryNavigation = useCallback(
    view => {
      setMobileMoreOpen(false)
      setDesktopMoreOpen(false)
      openView(view)
    },
    [openView]
  )

  const handleMobileNavigation = useCallback(
    view => {
      if (view === 'more') {
        setMobileMoreOpen(current => !current)
        return
      }

      setMobileMoreOpen(false)
      openView(view)
    },
    [openView]
  )

  const updateThemePrefs = useCallback(nextPartial => {
    setThemePrefs(current => {
      const next = { ...current, ...nextPartial }
      saveThemePrefs(next)
      return next
    })
  }, [])

  const mobileMoreGroups = useMemo(
    () =>
      buildMobileMoreGroups({
        active,
        canSwitchRoleView,
        moreNavItems,
        openMoreView,
        openStyleGuide,
        profile,
        roleView,
        signOut: () => supabase.auth.signOut(),
        styleGuideOpen,
        switchRoleView
      }),
    [active, canSwitchRoleView, moreNavItems, openMoreView, openStyleGuide, profile, roleView, styleGuideOpen, switchRoleView]
  )

  return (
    <div
      className="app"
      data-background-theme={themePrefs.backgroundTheme}
      data-sidebar-theme={themePrefs.sidebarTheme}
      data-testid="app-authenticated"
      style={themeStyle}
    >
      <div className="dashboard">
        <aside className="sidebar" data-testid="sidebar">
          <div className="brand">
            <div className="brand-mark">M</div>
            <div>
              <strong>MarketOS</strong>
              <div className="small muted">Verwaltungsbereich</div>
            </div>
          </div>

          <div className="nav">
            {navItems.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  className={active === item.key ? 'active' : ''}
                  data-testid={`sidebar-nav-${item.key}`}
                  onClick={() => handlePrimaryNavigation(item.key)}
                >
                  <Icon size={16} /> {item.label}
                </button>
              )
            })}
          </div>

          <div className="sidebar-bottom">
            {moreNavItems.length > 0 && (
              <div className="sidebar-more-nav">
                <button
                  aria-controls="sidebar-more-panel"
                  aria-expanded={desktopMoreOpen}
                  className={`sidebar-more-toggle${desktopMoreOpen ? ' active' : ''}`}
                  data-testid="sidebar-more-toggle"
                  onClick={() => setDesktopMoreOpen(current => !current)}
                  type="button"
                >
                  <Bell size={16} />
                  <span>Mehr Module</span>
                  {desktopMoreOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {desktopMoreOpen && (
                  <div className="nav sidebar-subnav" data-testid="sidebar-more-panel" id="sidebar-more-panel">
                    {moreNavItems.map(item => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.key}
                          className={active === item.key ? 'active' : ''}
                          data-testid={`sidebar-more-${item.key}`}
                          onClick={() => openMoreView(item.key)}
                          type="button"
                        >
                          <Icon size={16} /> {item.label}
                        </button>
                      )
                    })}
                    {profile?.is_admin === true && (
                      <button
                        className={active === 'analytics' ? 'active' : ''}
                        data-testid="sidebar-more-analytics"
                        onClick={() => openMoreView('analytics')}
                        type="button"
                      >
                        <analyticsNavItem.icon size={16} /> {analyticsNavItem.label}
                      </button>
                    )}
                    <button
                      className={styleGuideOpen ? 'active' : ''}
                      data-testid="sidebar-open-style-guide"
                      onClick={openStyleGuide}
                      type="button"
                    >
                      <Palette size={16} /> Style Guide
                    </button>
                  </div>
                )}
              </div>
            )}
            {canSwitchRoleView && (
              <>
                <p className="small">Ansicht</p>
                <div className="tabs">
                  <button
                    className={roleView === 'organizer' ? 'active' : ''}
                    data-testid="role-view-organizer"
                    onClick={() => switchRoleView('organizer')}
                  >
                    Veranstalter
                  </button>
                  <button
                    className={roleView === 'exhibitor' ? 'active' : ''}
                    data-testid="role-view-exhibitor"
                    onClick={() => switchRoleView('exhibitor')}
                  >
                    Aussteller
                  </button>
                </div>
              </>
            )}
            <div className="shell-utility-group">
              <p className="small muted">Konto</p>
              <button
                className="btn ghost sidebar-utility-button shell-utility-button shell-logout-button"
                data-testid="logout-button"
                onClick={() => supabase.auth.signOut()}
                type="button"
              >
                <LogOut size={16} /> Abmelden
              </button>
            </div>
          </div>
        </aside>

        <main>
          <div className="topbar row space-between" data-testid="dashboard-topbar">
            <div>
              <h1>{topbarTitle}</h1>
              <p className="muted">{topbarSubtitle}</p>
            </div>
            <div className="row">
              <button className="btn secondary mobile-only" onClick={() => navigate('/app')}>
                Menü
              </button>
              <button className="btn ghost" onClick={loadAll}>
                Aktualisieren
              </button>
              {showDemoSeedButton && !isVisitorProfile && (
                <button className="btn" onClick={seedDemo}>
                  Demo-Daten erstellen
                </button>
              )}
            </div>
          </div>

          {needsProfileName && (
            <form className="profile-setup card" data-testid="profile-setup-form" onSubmit={saveProfileName}>
              <div>
                <strong>Wie sollen wir dich im Dashboard nennen?</strong>
                <p className="muted">Dieser Name erscheint oben in der Begrüßung.</p>
              </div>
              <input
                className="input"
                data-testid="profile-name-input"
                placeholder="z. B. Edwin"
                required
                value={profileNameDraft}
                onChange={event => setProfileNameDraft(event.target.value)}
              />
              <button className="btn" data-testid="profile-name-save" disabled={savingProfileName}>
                {savingProfileName ? 'Speichert...' : 'Namen speichern'}
              </button>
            </form>
          )}

          {toast && (
            <div className={`toast ${toast.type}`} data-testid="toast-message">
              {toast.message}
            </div>
          )}

          {!isVisitorProfile && eventIssues.length > 0 && (
            <button
              className="toast error toast-action"
              data-testid="data-quality-warning"
              onClick={() => navigate('/app/events')}
              type="button"
            >
              Datenprüfung: {eventIssues.length} Event{eventIssues.length === 1 ? '' : 's'} mit fehlenden
              Pflichtfeldern oder ungültiger Stadt gefunden. Direkt zu Events wechseln.
            </button>
          )}

          {error && <p className="error">{error}</p>}

          {loading ? (
            <p className="notice">Lade Daten aus Supabase...</p>
          ) : (
            <ContentRouter
              active={active}
              announcements={announcements}
              contracts={contracts}
              eventIssues={eventIssues}
              events={events}
              exhibitorAnnouncements={exhibitorAnnouncements}
              exhibitorEvents={exhibitorEvents}
              exhibitorParticipants={exhibitorParticipants}
              favoriteEvents={favoriteEvents}
              favoriteVendors={favoriteVendors}
              locations={locations}
              linkableVendors={linkableVendors}
              notifications={notifications}
              notify={notify}
              openEventDetail={openEventDetail}
              openParticipantsView={openParticipantsView}
              openView={openView}
              participantViewEventId={participantViewEventId}
              participantViewFilter={participantViewFilter}
              participants={participants}
              profile={profile}
              profileName={profileName}
              publicUpdates={publicUpdates}
              reload={loadAll}
              reviews={reviews}
              roleView={roleView}
              selectedEvent={selectedEvent}
              eventEditIntent={eventEditIntent}
              setParticipantViewEventId={setParticipantViewEventId}
              setParticipantViewFilter={setParticipantViewFilter}
              stats={stats}
              taskSchemaReady={taskSchemaReady}
              tasks={tasks}
              templates={templates}
              vendorImages={vendorImages}
              vendorProfile={vendorProfile}
              subscription={subscription}
              closeEventDetail={closeEventDetail}
              clearEventEditIntent={() => setEventEditIntent(null)}
              openEventEditor={openEventEditor}
            />
          )}

          {mobileMoreOpen && (
            <div className="mobile-only card more-menu mobile-more-panel" data-testid="mobile-more-menu">
              <div className="mobile-more-groups">
                {mobileMoreGroups.map(group => (
                  <section
                    className="mobile-more-group"
                    data-testid={`mobile-more-group-${group.key}`}
                    key={group.key}
                  >
                    <p className="small muted mobile-more-group-title">{group.title}</p>
                    <div className="mobile-more-group-list">
                      {group.items.map(item => (
                        <button
                          key={item.key}
                          className={`mobile-more-button${item.active ? ' active' : ''}${item.tone === 'danger' ? ' mobile-more-button-danger' : ''}`}
                          data-testid={item.testId}
                          onClick={item.onClick}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </main>

        {!needsProfileName && !styleGuideOpen && (
          <MobileBottomNav
            activeView={active}
            isVisitor={isVisitorProfile}
            moreOpen={mobileMoreOpen}
            setActiveView={handleMobileNavigation}
          />
        )}
      </div>

      <StyleGuideModal
        backgroundThemes={backgroundThemes}
        busy={savingStyleGuide}
        onboardingMode={styleGuideMode === 'onboarding'}
        onClose={closeStyleGuide}
        onSave={saveStyleGuide}
        onThemeChange={updateThemePrefs}
        open={styleGuideOpen}
        sidebarThemes={sidebarThemes}
        themePrefs={themePrefs}
      />
    </div>
  )
}
