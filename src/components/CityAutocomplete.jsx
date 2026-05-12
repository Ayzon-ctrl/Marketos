import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { dedupeLocations, normalizeLocationSearch } from '../lib/eventUtils'
import { getUserErrorMessage } from '../lib/userError'

export default function CityAutocomplete({
  locations,
  selectedLocationId,
  setSelectedLocationId,
  error
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [remoteLocations, setRemoteLocations] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const selected =
    locations.find(location => location.id === selectedLocationId) ||
    remoteLocations.find(location => location.id === selectedLocationId)

  const displayValue = open ? query : selected ? selected.name : query
  const candidateLocations = remoteLocations.length ? remoteLocations : locations

  const filteredLocations = useMemo(() => {
    const normalizedQuery = normalizeLocationSearch(query)
    if (normalizedQuery.length < 2) return []

    return candidateLocations
      .map(location => ({
        location,
        searchName: normalizeLocationSearch(location.name),
        postalCode: String(location.postal_code || '').trim()
      }))
      .filter(
        entry =>
          entry.searchName.includes(normalizedQuery) ||
          entry.postalCode.includes(normalizedQuery)
      )
      .sort((a, b) => {
        const aRank = entryRank(a, normalizedQuery)
        const bRank = entryRank(b, normalizedQuery)
        if (aRank !== bRank) return aRank - bRank
        return a.location.name.localeCompare(b.location.name, 'de')
      })
      .map(entry => entry.location)
      .slice(0, 20)
  }, [query, candidateLocations])

  useEffect(() => {
    const rawQuery = query.trim()
    if (!open || rawQuery.length < 2) {
      setRemoteLocations([])
      setSearchError('')
      setSearching(false)
      return
    }

    let cancelled = false

    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError('')

      try {
        const isPostalCode = /^\d+$/.test(rawQuery)
        const safeQuery = rawQuery.replace(/[%_,]/g, '')
        const baseQuery = supabase
          .from('locations')
          .select('id,name,postal_code,state,country_code,ags')
          .limit(50)

        const result = await (isPostalCode
          ? baseQuery.like('postal_code', `${safeQuery}%`)
          : baseQuery.or(`name.ilike.*${safeQuery}*,postal_code.like.${safeQuery}*`))

        if (result.error) throw result.error
        if (!cancelled) setRemoteLocations(dedupeLocations(result.data || []))
      } catch (err) {
        if (!cancelled) {
          setRemoteLocations([])
          setSearchError(getUserErrorMessage(err, 'Ortssuche konnte nicht geladen werden.'))
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, open])

  return (
    <div className="field-group">
      <label htmlFor="event-city">Stadt *</label>
      <input
        id="event-city"
        data-testid="event-city"
        className={`input ${error ? 'input-error' : ''}`}
        value={displayValue}
        onFocus={() => {
          setQuery(selected ? selected.name : query)
          setOpen(true)
        }}
        onChange={event => {
          setQuery(event.target.value)
          setSelectedLocationId(null)
          setOpen(true)
        }}
        placeholder="Stadt oder PLZ suchen, z. B. Düsseldorf oder 40213"
        autoComplete="off"
      />

      {open && query.trim().length > 0 && query.trim().length < 2 && (
        <p className="field-hint">Mindestens 2 Buchstaben eingeben.</p>
      )}

      {open && query.trim().length >= 2 && (
        <div className="autocomplete-list">
          {searching && (
            <div className="autocomplete-empty" data-testid="city-search-loading">
              Suche Orte...
            </div>
          )}
          {searchError && (
            <div className="autocomplete-empty" data-testid="city-search-error">
              {searchError}
            </div>
          )}
          {filteredLocations.map(location => (
            <button
              key={location.id}
              type="button"
              className="autocomplete-item"
              data-testid="city-option"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                setSelectedLocationId(location)
                setQuery(location.name)
                setOpen(false)
              }}
            >
              {location.name}
            </button>
          ))}
          {filteredLocations.length === 0 && (
            <div className="autocomplete-empty" data-testid="city-empty">
              Keine Stadt gefunden
            </div>
          )}
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

function entryRank(entry, query) {
  if (entry.postalCode.startsWith(query)) return 0
  if (entry.searchName.startsWith(query)) return 1
  if (entry.postalCode.includes(query)) return 2
  return 3
}
