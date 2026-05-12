import { AtSign, Globe, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { sanitizeExternalUrl } from '../../lib/urlSafety'

function socialLabel(vendor) {
  if (sanitizeExternalUrl(vendor.instagram_url)) return 'Instagram'
  if (sanitizeExternalUrl(vendor.website_url)) return 'Webseite'
  if (sanitizeExternalUrl(vendor.facebook_url)) return 'Facebook'
  if (sanitizeExternalUrl(vendor.tiktok_url)) return 'TikTok'
  return 'Profil'
}

function promotionLabel(type) {
  if (type === 'featured') return 'Empfohlen'
  if (type === 'sponsored') return 'Sponsored'
  if (type === 'highlight') return 'Hervorgehoben'
  return ''
}

export default function PublicVendorCard({ vendor }) {
  const vendorId = vendor.id || vendor.vendor_profile_id
  const safeLogoUrl = sanitizeExternalUrl(vendor.logo_url)
  const safeInstagramUrl = sanitizeExternalUrl(vendor.instagram_url)
  const safeWebsiteUrl = sanitizeExternalUrl(vendor.website_url)

  return (
    <article className="public-card public-vendor-card" data-testid="public-vendor-card">
      <div className="public-vendor-media">
        {safeLogoUrl ? (
          <img src={safeLogoUrl} alt={`Logo von ${vendor.business_name}`} />
        ) : (
          <div className="public-vendor-placeholder">
            <Store size={22} />
          </div>
        )}
      </div>
      <div className="public-vendor-body">
        <div className="public-card-topline">
          <span className="pill">{vendor.category || 'Händler'}</span>
          <span className="pill ok">{(vendor.events || []).length} Events</span>
          {vendor.promotion_type && <span className="pill warn">{promotionLabel(vendor.promotion_type)}</span>}
        </div>
        <h3>{vendor.business_name}</h3>
        <p className="muted public-copy-clamp">
          {vendor.description || 'Profil folgt. Dieser Händler ist bereits öffentlich sichtbar.'}
        </p>
        <div className="public-link-row">
          {safeInstagramUrl && (
            <a href={safeInstagramUrl} target="_blank" rel="noopener noreferrer">
              <AtSign size={16} /> Instagram
            </a>
          )}
          {safeWebsiteUrl && (
            <a href={safeWebsiteUrl} target="_blank" rel="noopener noreferrer">
              <Globe size={16} /> Webseite
            </a>
          )}
          {!safeInstagramUrl && !safeWebsiteUrl && <span className="muted">{socialLabel(vendor)}</span>}
        </div>
        <Link className="btn" to={`/vendors/${vendorId}`}>
          Händler ansehen
        </Link>
      </div>
    </article>
  )
}
