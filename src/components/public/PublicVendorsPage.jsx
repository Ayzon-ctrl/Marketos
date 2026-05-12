import { useEffect, useMemo, useState } from 'react'
import PublicVendorCard from './PublicVendorCard'
import { loadPublicVendors } from '../../lib/publicData'
import { getUserErrorMessage } from '../../lib/userError'

export default function PublicVendorsPage() {
  const [vendors, setVendors] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await loadPublicVendors()
        if (!active) return
        setVendors(data)
        setError('')
      } catch (loadError) {
        if (!active) return
        setError(getUserErrorMessage(loadError, 'Händlerprofile konnten nicht geladen werden.'))
        setVendors([])
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const categories = useMemo(() => ['all', ...new Set(vendors.map(vendor => vendor.category).filter(Boolean))], [vendors])

  const filteredVendors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return vendors.filter(vendor => {
      const matchesSearch =
        !normalizedSearch ||
        vendor.business_name?.toLowerCase().includes(normalizedSearch) ||
        vendor.description?.toLowerCase().includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || vendor.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [categoryFilter, search, vendors])

  const promotedVendors = filteredVendors.filter(vendor => Boolean(vendor.promotion_type))
  const regularVendors = filteredVendors.filter(vendor => !vendor.promotion_type)

  return (
    <div className="public-page" data-testid="public-vendors-page">
      <section className="public-section-heading heroish">
        <div>
          <h1>Händler entdecken</h1>
          <p className="muted">
            Öffentliche Händlerprofile mit Kategorie, Social Links und den nächsten Events, bei denen
            sie vertreten sind.
          </p>
        </div>
      </section>

      {error && (
        <div className="card public-state-card" data-testid="public-page-error">
          <strong>Öffentliche Händler brauchen noch Setup</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="card public-filter-card">
        <div className="form-grid">
          <div className="field-group">
            <label htmlFor="vendor-search">Händlername</label>
            <input
              id="vendor-search"
              className="input"
              data-testid="public-vendor-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Nach Name oder Beschreibung suchen"
            />
          </div>

          <div className="field-group">
            <label htmlFor="vendor-category-filter">Kategorie</label>
            <select
              id="vendor-category-filter"
              className="input"
              data-testid="public-vendor-category-filter"
              value={categoryFilter}
              onChange={event => setCategoryFilter(event.target.value)}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'Alle Kategorien' : category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {promotedVendors.length > 0 && (
        <section className="public-section" data-testid="promoted-vendors-list">
          <div className="public-section-heading">
            <div>
              <h2>Empfohlene Händler</h2>
              <p className="muted">Aktive Hervorhebungen werden dezent oberhalb der Trefferliste gezeigt.</p>
            </div>
          </div>
          <div className="public-card-grid vendors">
            {promotedVendors.map(vendor => (
              <PublicVendorCard key={`promoted-${vendor.id}`} vendor={vendor} />
            ))}
          </div>
        </section>
      )}

      <section className="public-card-grid vendors">
        {!loading && promotedVendors.length === 0 && regularVendors.length === 0 && !error && (
          <div className="card public-state-card" data-testid="public-page-empty">
            Keine öffentlichen Händler für diesen Filter gefunden.
          </div>
        )}
        {regularVendors.map(vendor => (
          <PublicVendorCard key={vendor.id} vendor={vendor} />
        ))}
      </section>
    </div>
  )
}
