import { useEffect, useState } from 'react'
import { AtSign, Globe, Heart, Store } from 'lucide-react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { fmtDateRange } from '../../lib/eventUtils'
import { loadPublicVendorDetail, loadVendorFavoriteState, toggleVendorFavorite } from '../../lib/publicData'
import { sanitizeExternalUrl } from '../../lib/urlSafety'
import { getUserErrorMessage } from '../../lib/userError'

function SocialLink({ href, label, icon }) {
  const safeHref = sanitizeExternalUrl(href)
  if (!safeHref) return null
  const Icon = icon

  return (
    <a className="public-social-link" href={safeHref} rel="noopener noreferrer" target="_blank">
      <Icon size={16} /> {label}
    </a>
  )
}

export default function PublicVendorDetailPage() {
  const { vendorId } = useParams()
  const { session } = useOutletContext()
  const [state, setState] = useState({
    loading: true,
    error: '',
    vendor: null,
    images: [],
    events: [],
    updates: []
  })
  const [favoriteState, setFavoriteState] = useState({ loading: false, saved: false, error: '' })

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await loadPublicVendorDetail(vendorId)
        if (!active) return
        setState({
          loading: false,
          error: '',
          vendor: data.vendor,
          images: data.images,
          events: data.events,
          updates: data.updates
        })
      } catch (error) {
        if (!active) return
        setState({
          loading: false,
          error: getUserErrorMessage(error, 'Händlerprofil konnte nicht geladen werden.'),
          vendor: null,
          images: [],
          events: [],
          updates: []
        })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [vendorId])

  useEffect(() => {
    let active = true
    if (!session?.user?.id || !vendorId) {
      setFavoriteState({ loading: false, saved: false, error: '' })
      return
    }

    async function loadFavorite() {
      setFavoriteState(current => ({ ...current, loading: true, error: '' }))
      try {
        const saved = await loadVendorFavoriteState(session.user.id, vendorId)
        if (!active) return
        setFavoriteState({ loading: false, saved, error: '' })
      } catch (error) {
        if (!active) return
        setFavoriteState({ loading: false, saved: false, error: getUserErrorMessage(error, 'Favorit konnte nicht geladen werden.') })
      }
    }

    loadFavorite()
    return () => {
      active = false
    }
  }, [session, vendorId])

  async function handleFavoriteToggle() {
    if (!session?.user?.id || !state.vendor) return
    setFavoriteState(current => ({ ...current, loading: true, error: '' }))
    try {
      const saved = await toggleVendorFavorite({
        userId: session.user.id,
        vendorProfileId: state.vendor.id,
        saved: favoriteState.saved
      })
      setFavoriteState({ loading: false, saved, error: '' })
    } catch (error) {
      setFavoriteState(current => ({
        ...current,
        loading: false,
        error: getUserErrorMessage(error, 'Favorit konnte nicht gespeichert werden.')
      }))
    }
  }

  if (state.error) {
    return (
      <div className="public-page" data-testid="public-vendor-detail-page">
        <div className="card public-state-card" data-testid="public-page-error">
          <strong>Öffentliches Händlerprofil braucht noch Setup</strong>
          <p>{state.error}</p>
        </div>
      </div>
    )
  }

  if (!state.loading && !state.vendor) {
    return (
      <div className="public-page" data-testid="public-vendor-detail-page">
        <div className="card public-state-card" data-testid="public-page-empty">
          Dieses Händlerprofil ist nicht öffentlich sichtbar oder existiert nicht mehr.
        </div>
      </div>
    )
  }

  const vendor = state.vendor
  const safeLogoUrl = sanitizeExternalUrl(vendor?.logo_url)

  return (
    <div className="public-page" data-testid="public-vendor-detail-page">
      {vendor && (
        <>
          <section className="public-detail-hero vendor-detail-hero">
            <div className="vendor-identity-card">
              <div className="public-vendor-media detail">
                {safeLogoUrl ? (
                  <img alt={`Logo von ${vendor.business_name}`} src={safeLogoUrl} />
                ) : (
                  <div className="public-vendor-placeholder large">
                    <Store size={28} />
                  </div>
                )}
              </div>
              <div>
                <div className="row detail-action-row">
                  <Link className="btn ghost" to="/vendors">
                    Zurück zu Händlern
                  </Link>
                  {session?.user ? (
                    <button
                      className={`btn ${favoriteState.saved ? 'secondary' : ''}`}
                      data-testid="favorite-vendor-toggle"
                      disabled={favoriteState.loading}
                      onClick={handleFavoriteToggle}
                      type="button"
                    >
                      <Heart size={16} />{' '}
                      {favoriteState.loading ? 'Speichert...' : favoriteState.saved ? 'Gespeichert' : 'Speichern'}
                    </button>
                  ) : (
                    <span className="muted public-utility-note">
                      Zum Speichern bitte den Login oben rechts nutzen.
                    </span>
                  )}
                </div>
                <h1>{vendor.business_name}</h1>
                <div className="public-detail-meta">
                  <span className="pill">{vendor.category || 'Händler'}</span>
                  <span className="pill ok">{state.events.length} kommende Events</span>
                </div>
                <p className="public-detail-copy">
                  {vendor.description ||
                    'Dieses Händlerprofil ist öffentlich, aber die ausführliche Beschreibung folgt noch.'}
                </p>
                {favoriteState.error && <p className="error">{favoriteState.error}</p>}
                <div className="public-link-row wide">
                  <SocialLink href={vendor.instagram_url} icon={AtSign} label="Instagram" />
                  <SocialLink href={vendor.website_url} icon={Globe} label="Webseite" />
                  <SocialLink href={vendor.facebook_url} icon={Globe} label="Facebook" />
                  <SocialLink href={vendor.tiktok_url} icon={Globe} label="TikTok" />
                </div>
              </div>
            </div>
          </section>

          <section className="public-section">
            <div className="public-section-heading">
              <div>
                <h2>Aktuelle Updates</h2>
                <p className="muted">Neue Hinweise, neue Produkte oder kurzfristige Event-Infos.</p>
              </div>
            </div>
            <div className="list">
              {state.updates.length === 0 && (
                <div className="card public-state-card" data-testid="public-page-empty">
                  Noch keine öffentlichen Updates für dieses Profil.
                </div>
              )}
              {state.updates.map(update => (
                <div className="item" data-testid="public-vendor-update" key={update.id}>
                  <strong>{update.title}</strong>
                  <p className="muted">{update.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="public-section">
            <div className="public-section-heading">
              <div>
                <h2>Bilder & Waren</h2>
                <p className="muted">Warenbilder werden sauber direkt im öffentlichen Profil gezeigt.</p>
              </div>
            </div>
            <div className="public-image-grid">
              {state.images.length === 0 && (
                <div className="card public-state-card" data-testid="public-page-empty">
                  Noch keine Warenbilder hinterlegt.
                </div>
              )}
              {state.images.map(image => (
                <figure className="public-image-card" key={image.id}>
                  {sanitizeExternalUrl(image.image_url) ? (
                    <img
                      alt={image.caption || `Bild von ${vendor.business_name}`}
                      src={sanitizeExternalUrl(image.image_url)}
                    />
                  ) : (
                    <div className="public-vendor-placeholder">Bild nicht verfügbar</div>
                  )}
                  {image.caption && <figcaption>{image.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>

          <section className="public-section">
            <div className="public-section-heading">
              <div>
                <h2>Kommende Events</h2>
                <p className="muted">Hier sieht man direkt, wo dieser Händler als Nächstes vertreten ist.</p>
              </div>
            </div>
            <div className="list">
              {state.events.length === 0 && (
                <div className="card public-state-card" data-testid="public-page-empty">
                  Aktuell sind noch keine kommenden öffentlichen Events verknüpft.
                </div>
              )}
              {state.events.map(event => (
                <Link className="item public-linked-item" key={event.event_id} to={`/markets/${event.event_id}`}>
                  <strong>{event.title || 'Ohne Eventname'}</strong>
                  <p className="muted">
                    {fmtDateRange(event.event_date, event.end_date)} · {event.location || 'Ort folgt'}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
