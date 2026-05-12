import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { getUserErrorMessage } from '../../lib/userError'
import ConfirmModal from '../ConfirmModal'

// ─────────────────────────────────────────────────────────
// Lookup-Tabellen
// ─────────────────────────────────────────────────────────

const AREA_TYPE_LABELS = {
  indoor: 'Drinnen',
  outdoor: 'Draußen',
  both: 'Drinnen & draußen',
  covered: 'Überdacht',
  partially_covered: 'Teilweise überdacht'
}

const PRICING_TYPE_LABELS = {
  flat: 'Pauschale Standgebühr',
  fixed_size: 'Feste Standgröße',
  up_to_length: 'Bis-Länge / max. Frontlänge',
  per_meter: 'Preis pro lfd. Meter',
  per_sqm: 'Preis pro m²',
  base_plus_extra: 'Grundpreis + Zusatzmeter',
  tiered_length: 'Staffelpreis / Preisbereiche',
  custom: 'Sonderpreis / Freitext'
}

const SURFACE_TYPES = [
  { value: 'beton', label: 'Beton' },
  { value: 'pflastersteine', label: 'Pflastersteine' },
  { value: 'asphalt', label: 'Asphalt' },
  { value: 'wiese', label: 'Wiese' },
  { value: 'erde', label: 'Erde' },
  { value: 'sand', label: 'Sand' },
  { value: 'schotter', label: 'Schotter' },
  { value: 'holzboden', label: 'Holzboden' },
  { value: 'hallenboden', label: 'Hallenboden' },
  { value: 'unbefestigt', label: 'Unbefestigt' },
  { value: 'sonstiges', label: 'Sonstiges' }
]

const ADDON_TYPES = [
  { value: 'electricity', label: 'Stromanschluss' },
  { value: 'water', label: 'Wasseranschluss' },
  { value: 'table', label: 'Tisch' },
  { value: 'chair', label: 'Stuhl' },
  { value: 'pavilion', label: 'Pavillon' },
  { value: 'waste_fee', label: 'Müllpauschale' },
  { value: 'cleaning_fee', label: 'Reinigungspauschale' },
  { value: 'parking_fee', label: 'Parkgebühr' },
  { value: 'deposit', label: 'Kaution' },
  { value: 'other', label: 'Sonstiges' }
]

// ─────────────────────────────────────────────────────────
// Euro / Cent Konvertierung
// ─────────────────────────────────────────────────────────

function centsToEuroStr(cents) {
  if (cents == null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

function euroStrToCents(val) {
  if (val === '' || val == null) return null
  const n = parseFloat(String(val).replace(',', '.'))
  if (isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

function parseMetric(val) {
  if (val === '' || val == null) return null
  const n = parseFloat(String(val).replace(',', '.'))
  if (isNaN(n) || n < 0) return null
  return n
}

function parseSortOrder(val) {
  const n = parseInt(val, 10)
  return isNaN(n) || n < 0 ? 0 : n
}

// ─────────────────────────────────────────────────────────
// Leere Formulare
// ─────────────────────────────────────────────────────────

function emptyOptionForm() {
  return {
    label: '',
    description: '',
    area_type: 'outdoor',
    surface_types: [],
    surface_notes: '',
    pricing_type: 'flat',
    width_m: '',
    depth_m: '',
    min_length_m: '',
    max_length_m: '',
    included_length_m: '',
    max_depth_m: '',
    price_euros: '',
    price_per_meter_euros: '',
    price_per_sqm_euros: '',
    price_per_extra_meter_euros: '',
    is_price_on_request: false,
    pricing_description: '',
    is_available: true,
    public_visible: false,
    sort_order: '0'
  }
}

function emptyTierForm() {
  return {
    label: '',
    min_length_m: '',
    max_length_m: '',
    min_depth_m: '',
    max_depth_m: '',
    min_area_sqm: '',
    max_area_sqm: '',
    price_euros: '',
    price_per_meter_euros: '',
    price_per_sqm_euros: '',
    price_per_extra_meter_euros: '',
    is_price_on_request: false,
    sort_order: '0'
  }
}

function emptyAddonForm() {
  return {
    addon_type: 'electricity',
    label: '',
    description: '',
    price_euros: '',
    is_price_on_request: false,
    is_available: true,
    public_visible: false,
    sort_order: '0'
  }
}

// ─────────────────────────────────────────────────────────
// DB-Record → Formular befüllen
// ─────────────────────────────────────────────────────────

function optionToForm(o) {
  return {
    label: o.label || '',
    description: o.description || '',
    area_type: o.area_type || 'outdoor',
    surface_types: o.surface_types || [],
    surface_notes: o.surface_notes || '',
    pricing_type: o.pricing_type || 'flat',
    width_m: o.width_m != null ? String(o.width_m) : '',
    depth_m: o.depth_m != null ? String(o.depth_m) : '',
    min_length_m: o.min_length_m != null ? String(o.min_length_m) : '',
    max_length_m: o.max_length_m != null ? String(o.max_length_m) : '',
    included_length_m: o.included_length_m != null ? String(o.included_length_m) : '',
    max_depth_m: o.max_depth_m != null ? String(o.max_depth_m) : '',
    price_euros: centsToEuroStr(o.price_cents),
    price_per_meter_euros: centsToEuroStr(o.price_per_meter_cents),
    price_per_sqm_euros: centsToEuroStr(o.price_per_sqm_cents),
    price_per_extra_meter_euros: centsToEuroStr(o.price_per_extra_meter_cents),
    is_price_on_request: Boolean(o.is_price_on_request),
    pricing_description: o.pricing_description || '',
    is_available: o.is_available !== false,
    public_visible: Boolean(o.public_visible),
    sort_order: o.sort_order != null ? String(o.sort_order) : '0'
  }
}

function tierToForm(t) {
  return {
    label: t.label || '',
    min_length_m: t.min_length_m != null ? String(t.min_length_m) : '',
    max_length_m: t.max_length_m != null ? String(t.max_length_m) : '',
    min_depth_m: t.min_depth_m != null ? String(t.min_depth_m) : '',
    max_depth_m: t.max_depth_m != null ? String(t.max_depth_m) : '',
    min_area_sqm: t.min_area_sqm != null ? String(t.min_area_sqm) : '',
    max_area_sqm: t.max_area_sqm != null ? String(t.max_area_sqm) : '',
    price_euros: centsToEuroStr(t.price_cents),
    price_per_meter_euros: centsToEuroStr(t.price_per_meter_cents),
    price_per_sqm_euros: centsToEuroStr(t.price_per_sqm_cents),
    price_per_extra_meter_euros: centsToEuroStr(t.price_per_extra_meter_cents),
    is_price_on_request: Boolean(t.is_price_on_request),
    sort_order: t.sort_order != null ? String(t.sort_order) : '0'
  }
}

function addonToForm(a) {
  return {
    addon_type: a.addon_type || 'electricity',
    label: a.label || '',
    description: a.description || '',
    price_euros: centsToEuroStr(a.price_cents),
    is_price_on_request: Boolean(a.is_price_on_request),
    is_available: a.is_available !== false,
    public_visible: Boolean(a.public_visible),
    sort_order: a.sort_order != null ? String(a.sort_order) : '0'
  }
}

// ─────────────────────────────────────────────────────────
// DB Payload Builder
// ─────────────────────────────────────────────────────────

function buildOptionPayload(form, eventId) {
  return {
    event_id: eventId,
    label: form.label.trim(),
    description: form.description.trim() || null,
    area_type: form.area_type,
    surface_types: form.surface_types,
    surface_notes: form.surface_notes.trim() || null,
    pricing_type: form.pricing_type,
    width_m: parseMetric(form.width_m),
    depth_m: parseMetric(form.depth_m),
    min_length_m: parseMetric(form.min_length_m),
    max_length_m: parseMetric(form.max_length_m),
    included_length_m: parseMetric(form.included_length_m),
    max_depth_m: parseMetric(form.max_depth_m),
    price_cents: euroStrToCents(form.price_euros),
    price_per_meter_cents: euroStrToCents(form.price_per_meter_euros),
    price_per_sqm_cents: euroStrToCents(form.price_per_sqm_euros),
    price_per_extra_meter_cents: euroStrToCents(form.price_per_extra_meter_euros),
    is_price_on_request: Boolean(form.is_price_on_request),
    pricing_description: form.pricing_description.trim() || null,
    is_available: Boolean(form.is_available),
    public_visible: Boolean(form.public_visible),
    sort_order: parseSortOrder(form.sort_order)
  }
}

function buildTierPayload(form, standOptionId) {
  return {
    stand_option_id: standOptionId,
    label: form.label.trim() || null,
    min_length_m: parseMetric(form.min_length_m),
    max_length_m: parseMetric(form.max_length_m),
    min_depth_m: parseMetric(form.min_depth_m),
    max_depth_m: parseMetric(form.max_depth_m),
    min_area_sqm: parseMetric(form.min_area_sqm),
    max_area_sqm: parseMetric(form.max_area_sqm),
    price_cents: euroStrToCents(form.price_euros),
    price_per_meter_cents: euroStrToCents(form.price_per_meter_euros),
    price_per_sqm_cents: euroStrToCents(form.price_per_sqm_euros),
    price_per_extra_meter_cents: euroStrToCents(form.price_per_extra_meter_euros),
    is_price_on_request: Boolean(form.is_price_on_request),
    sort_order: parseSortOrder(form.sort_order)
  }
}

function buildAddonPayload(form, eventId) {
  return {
    event_id: eventId,
    addon_type: form.addon_type,
    label: form.label.trim(),
    description: form.description.trim() || null,
    price_cents: euroStrToCents(form.price_euros),
    is_price_on_request: Boolean(form.is_price_on_request),
    is_available: Boolean(form.is_available),
    public_visible: Boolean(form.public_visible),
    sort_order: parseSortOrder(form.sort_order)
  }
}

// ─────────────────────────────────────────────────────────
// Anzeige-Helfer
// ─────────────────────────────────────────────────────────

function formatOptionPrice(o) {
  if (o.is_price_on_request) return 'Preis auf Anfrage'
  if (o.pricing_type === 'tiered_length') return 'Staffelpreis (Preisbereiche)'
  if (o.pricing_type === 'custom') return o.pricing_description || 'Sonderpreis'
  const parts = []
  if (o.price_cents != null) parts.push(`${centsToEuroStr(o.price_cents)} €`)
  if (o.price_per_meter_cents != null) parts.push(`${centsToEuroStr(o.price_per_meter_cents)} €/m`)
  if (o.price_per_sqm_cents != null) parts.push(`${centsToEuroStr(o.price_per_sqm_cents)} €/m²`)
  if (o.price_per_extra_meter_cents != null)
    parts.push(`+ ${centsToEuroStr(o.price_per_extra_meter_cents)} €/m`)
  return parts.join(' · ') || '–'
}

function formatAddonPrice(a) {
  if (a.is_price_on_request) return 'Preis auf Anfrage'
  if (a.price_cents != null) return `${centsToEuroStr(a.price_cents)} €`
  return '–'
}

// ─────────────────────────────────────────────────────────
// Sub-Komponente: OptionForm
// ─────────────────────────────────────────────────────────

function OptionForm({ form, setForm, onSave, onCancel, saving, isNew }) {
  const pt = form.pricing_type
  const showFlatPrice = pt === 'flat' || pt === 'fixed_size' || pt === 'up_to_length' || pt === 'base_plus_extra'
  const showPerMeterPrice = pt === 'per_meter'
  const showPerSqmPrice = pt === 'per_sqm'
  const showExtraPrice = pt === 'base_plus_extra'
  const showDimensions = pt === 'fixed_size' || pt === 'up_to_length' || pt === 'base_plus_extra'
  const isTiered = pt === 'tiered_length'
  const isCustom = pt === 'custom'

  return (
    <div className="stand-option-inline-form" data-testid="stand-option-form">
      {/* Bezeichnung */}
      <div className="form-grid">
        <div className="field-group">
          <label>Bezeichnung *</label>
          <input
            className="input"
            data-testid="stand-option-label-input"
            placeholder="z. B. Außenstand bis 3 m"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          />
        </div>
        <div className="field-group">
          <label>Beschreibung</label>
          <input
            className="input"
            placeholder="Optionale Beschreibung"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
      </div>

      {/* Bereich & Preismodell */}
      <div className="form-grid">
        <div className="field-group">
          <label>Bereich / Standort *</label>
          <select
            data-testid="stand-option-area-type-select"
            value={form.area_type}
            onChange={e => setForm(f => ({ ...f, area_type: e.target.value }))}
          >
            {Object.entries(AREA_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Preismodell *</label>
          <select
            data-testid="stand-option-pricing-type-select"
            value={form.pricing_type}
            onChange={e => setForm(f => ({ ...f, pricing_type: e.target.value }))}
          >
            {Object.entries(PRICING_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Preisfelder */}
      {!isTiered && (
        <div className="form-grid">
          {showFlatPrice && (
            <div className="field-group">
              <label>Standgebühr (€)</label>
              <input
                className="input"
                data-testid="stand-option-price-input"
                placeholder="z. B. 50,00"
                value={form.price_euros}
                onChange={e => setForm(f => ({ ...f, price_euros: e.target.value }))}
              />
              <p className="field-hint">
                {pt === 'up_to_length'
                  ? 'Pauschalpreis bis zur max. Frontlänge'
                  : pt === 'base_plus_extra'
                    ? 'Grundpreis (inkl. enthaltener Länge)'
                    : 'Standgebühr in Euro'}
              </p>
            </div>
          )}
          {showPerMeterPrice && (
            <div className="field-group">
              <label>Preis pro lfd. Meter (€)</label>
              <input
                className="input"
                data-testid="stand-option-price-input"
                placeholder="z. B. 12,00"
                value={form.price_per_meter_euros}
                onChange={e => setForm(f => ({ ...f, price_per_meter_euros: e.target.value }))}
              />
              <p className="field-hint">Preis je laufendem Meter Frontlänge</p>
            </div>
          )}
          {showPerSqmPrice && (
            <div className="field-group">
              <label>Preis pro m² (€)</label>
              <input
                className="input"
                data-testid="stand-option-price-input"
                placeholder="z. B. 8,00"
                value={form.price_per_sqm_euros}
                onChange={e => setForm(f => ({ ...f, price_per_sqm_euros: e.target.value }))}
              />
              <p className="field-hint">Preis je Quadratmeter Standfläche</p>
            </div>
          )}
          {showExtraPrice && (
            <div className="field-group">
              <label>Jeder weitere Meter (€)</label>
              <input
                className="input"
                placeholder="z. B. 8,00"
                value={form.price_per_extra_meter_euros}
                onChange={e =>
                  setForm(f => ({ ...f, price_per_extra_meter_euros: e.target.value }))
                }
              />
              <p className="field-hint">Preis je Zusatzmeter über die enthaltene Länge</p>
            </div>
          )}
          {!isCustom && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.is_price_on_request}
                onChange={e =>
                  setForm(f => ({ ...f, is_price_on_request: e.target.checked }))
                }
              />
              <span>Preis auf Anfrage</span>
            </label>
          )}
        </div>
      )}

      {/* Maßfelder */}
      {showDimensions && (
        <div className="form-grid">
          {pt === 'fixed_size' && (
            <>
              <div className="field-group">
                <label>Breite in m</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="z. B. 3,0"
                  value={form.width_m}
                  onChange={e => setForm(f => ({ ...f, width_m: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Tiefe in m</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="z. B. 3,0"
                  value={form.depth_m}
                  onChange={e => setForm(f => ({ ...f, depth_m: e.target.value }))}
                />
              </div>
            </>
          )}
          {(pt === 'up_to_length' || pt === 'base_plus_extra') && (
            <div className="field-group">
              <label>Max. Frontlänge in m</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.1"
                placeholder="z. B. 3,0"
                value={form.max_length_m}
                onChange={e => setForm(f => ({ ...f, max_length_m: e.target.value }))}
              />
              <p className="field-hint">
                Bis {form.max_length_m || '?'} m Frontlänge
              </p>
            </div>
          )}
          {pt === 'base_plus_extra' && (
            <div className="field-group">
              <label>Im Grundpreis enthaltene Länge (m)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.1"
                placeholder="z. B. 3,0"
                value={form.included_length_m}
                onChange={e => setForm(f => ({ ...f, included_length_m: e.target.value }))}
              />
              <p className="field-hint">
                Bis {form.included_length_m || '?'} m im Grundpreis enthalten
              </p>
            </div>
          )}
          {(pt === 'fixed_size' || pt === 'base_plus_extra') && (
            <div className="field-group">
              <label>Max. Tiefe in m</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.1"
                placeholder="z. B. 3,0"
                value={form.max_depth_m}
                onChange={e => setForm(f => ({ ...f, max_depth_m: e.target.value }))}
              />
              <p className="field-hint">Tiefe maximal {form.max_depth_m || '?'} m</p>
            </div>
          )}
        </div>
      )}

      {isTiered && (
        <div className="notice">
          Preisbereiche werden nach dem Speichern unter dieser Standoption verwaltet.
        </div>
      )}

      {isCustom && (
        <div className="form-section-grid">
          <div className="field-group">
            <label>Preisbeschreibung *</label>
            <input
              className="input"
              placeholder="Beschreibung des Sonderpreises"
              value={form.pricing_description}
              onChange={e => setForm(f => ({ ...f, pricing_description: e.target.value }))}
            />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.is_price_on_request}
              onChange={e => setForm(f => ({ ...f, is_price_on_request: e.target.checked }))}
            />
            <span>Preis auf Anfrage</span>
          </label>
        </div>
      )}

      {/* Untergrund */}
      <div className="field-group">
        <label>Untergrund (Mehrfachauswahl)</label>
        <div className="surface-checkbox-grid">
          {SURFACE_TYPES.map(({ value, label }) => (
            <label className="checkbox-row" key={value}>
              <input
                type="checkbox"
                checked={form.surface_types.includes(value)}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    surface_types: e.target.checked
                      ? [...f.surface_types, value]
                      : f.surface_types.filter(t => t !== value)
                  }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label>Untergrundhinweis</label>
        <input
          className="input"
          placeholder="z. B. Pavillongewichte erforderlich"
          value={form.surface_notes}
          onChange={e => setForm(f => ({ ...f, surface_notes: e.target.value }))}
        />
      </div>

      {/* Status */}
      <div className="form-grid">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))}
          />
          <span>Verfügbar</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.public_visible}
            onChange={e => setForm(f => ({ ...f, public_visible: e.target.checked }))}
          />
          <span>Öffentlich vorbereitet (noch keine Wirkung)</span>
        </label>
      </div>

      <div className="field-group">
        <label>Sortierung</label>
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          value={form.sort_order}
          onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
        />
        <p className="field-hint">Niedrigere Zahl = wird zuerst angezeigt</p>
      </div>

      <div className="form-actions-secondary">
        <button
          className="btn"
          data-testid="stand-option-save-btn"
          disabled={saving}
          onClick={onSave}
          type="button"
        >
          {saving ? 'Speichert…' : isNew ? 'Standoption anlegen' : 'Änderungen speichern'}
        </button>
        <button className="btn ghost" onClick={onCancel} type="button">
          Abbrechen
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Sub-Komponente: TierForm
// ─────────────────────────────────────────────────────────

function TierForm({ form, setForm, onSave, onCancel, saving, isNew }) {
  return (
    <div className="price-tier-inline-form" data-testid="price-tier-form">
      <div className="field-group">
        <label>Bezeichnung des Preisbereichs</label>
        <input
          className="input"
          placeholder="z. B. Bis 3 m Frontlänge"
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
        />
        <p className="field-hint">
          Beispiel: „Über 3 m bis 6 m Frontlänge" · „Ab 9 m: Preis auf Anfrage"
        </p>
      </div>

      <div className="form-grid">
        <div className="field-group">
          <label>Min. Länge (m)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.1"
            placeholder="z. B. 0"
            value={form.min_length_m}
            onChange={e => setForm(f => ({ ...f, min_length_m: e.target.value }))}
          />
          <p className="field-hint">Ab {form.min_length_m || '?'} m Frontlänge</p>
        </div>
        <div className="field-group">
          <label>Max. Länge (m)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.1"
            placeholder="z. B. 3,0"
            value={form.max_length_m}
            onChange={e => setForm(f => ({ ...f, max_length_m: e.target.value }))}
          />
          <p className="field-hint">Bis {form.max_length_m || '?'} m Frontlänge</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="field-group">
          <label>Preis (€)</label>
          <input
            className="input"
            data-testid="price-tier-price-input"
            placeholder="z. B. 50,00"
            value={form.price_euros}
            onChange={e => setForm(f => ({ ...f, price_euros: e.target.value }))}
          />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.is_price_on_request}
            onChange={e => setForm(f => ({ ...f, is_price_on_request: e.target.checked }))}
          />
          <span>Preis auf Anfrage</span>
        </label>
      </div>

      <div className="field-group">
        <label>Sortierung</label>
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          value={form.sort_order}
          onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
        />
      </div>

      <div className="form-actions-secondary">
        <button
          className="btn"
          data-testid="price-tier-save-btn"
          disabled={saving}
          onClick={onSave}
          type="button"
        >
          {saving ? 'Speichert…' : isNew ? 'Preisbereich anlegen' : 'Speichern'}
        </button>
        <button className="btn ghost" onClick={onCancel} type="button">
          Abbrechen
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Sub-Komponente: PriceTiersBlock
// ─────────────────────────────────────────────────────────

function PriceTiersBlock({
  option,
  tiers,
  expanded,
  onToggle,
  editingTierId,
  tierParentOptionId,
  tierForm,
  setTierForm,
  onNewTier,
  onEditTier,
  onSaveTier,
  onCancelTier,
  tierSaving,
  onDeleteTier
}) {
  const isThisOption = tierParentOptionId === option.id

  return (
    <div className="price-tier-section">
      <button
        className="btn ghost"
        data-testid="price-tier-toggle-btn"
        onClick={onToggle}
        type="button"
        style={{ textAlign: 'left', justifyContent: 'flex-start' }}
      >
        {expanded ? '▾' : '▸'} Preisbereiche ({tiers.length})
      </button>

      {expanded && (
        <div className="price-tier-list" data-testid="price-tier-list">
          {tiers.length === 0 && !isThisOption && (
            <p className="field-hint">Noch keine Preisbereiche hinterlegt.</p>
          )}

          {tiers.map(tier => (
            <div className="price-tier-row" key={tier.id} data-testid="price-tier-item">
              <div className="price-tier-row-summary">
                <div>
                  <strong>{tier.label || 'Preisbereich'}</strong>
                  <p className="field-hint" style={{ margin: 0 }}>
                    {tier.min_length_m != null ? `Ab ${tier.min_length_m} m` : ''}
                    {tier.max_length_m != null ? ` bis ${tier.max_length_m} m` : ''}
                    {tier.is_price_on_request
                      ? ' · Preis auf Anfrage'
                      : tier.price_cents != null
                        ? ` · ${centsToEuroStr(tier.price_cents)} €`
                        : ''}
                  </p>
                </div>
                <div className="stand-option-row-actions">
                  <button
                    className="btn ghost"
                    data-testid="price-tier-edit-btn"
                    onClick={() =>
                      editingTierId === tier.id && isThisOption
                        ? onCancelTier()
                        : onEditTier(tier)
                    }
                    type="button"
                  >
                    {editingTierId === tier.id && isThisOption ? 'Abbrechen' : 'Bearbeiten'}
                  </button>
                  <button
                    className="btn danger-outline"
                    data-testid="price-tier-delete-btn"
                    onClick={() => onDeleteTier(tier)}
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {editingTierId === tier.id && isThisOption && (
                <TierForm
                  form={tierForm}
                  setForm={setTierForm}
                  onSave={onSaveTier}
                  onCancel={onCancelTier}
                  saving={tierSaving}
                  isNew={false}
                />
              )}
            </div>
          ))}

          {editingTierId === 'new' && isThisOption && (
            <div className="price-tier-row">
              <TierForm
                form={tierForm}
                setForm={setTierForm}
                onSave={onSaveTier}
                onCancel={onCancelTier}
                saving={tierSaving}
                isNew
              />
            </div>
          )}

          {(!editingTierId || !isThisOption) && (
            <button
              className="btn secondary"
              data-testid="price-tier-add-btn"
              onClick={onNewTier}
              type="button"
            >
              <Plus size={15} /> Preisbereich anlegen
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Sub-Komponente: AddonForm
// ─────────────────────────────────────────────────────────

function AddonForm({ form, setForm, onSave, onCancel, saving, isNew }) {
  return (
    <div className="stand-option-inline-form" data-testid="addon-option-form">
      <div className="form-grid">
        <div className="field-group">
          <label>Art der Zusatzoption *</label>
          <select
            data-testid="addon-option-type-select"
            value={form.addon_type}
            onChange={e => setForm(f => ({ ...f, addon_type: e.target.value }))}
          >
            {ADDON_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Bezeichnung *</label>
          <input
            className="input"
            data-testid="addon-option-label-input"
            placeholder="z. B. Stromanschluss 16A"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          />
        </div>
      </div>

      <div className="field-group">
        <label>Beschreibung</label>
        <textarea
          placeholder="Optionale Details"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          style={{ minHeight: 60 }}
        />
      </div>

      <div className="form-grid">
        <div className="field-group">
          <label>Preis (€)</label>
          <input
            className="input"
            data-testid="addon-option-price-input"
            placeholder="z. B. 10,00"
            value={form.price_euros}
            onChange={e => setForm(f => ({ ...f, price_euros: e.target.value }))}
          />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.is_price_on_request}
            onChange={e => setForm(f => ({ ...f, is_price_on_request: e.target.checked }))}
          />
          <span>Preis auf Anfrage</span>
        </label>
      </div>

      <div className="form-grid">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))}
          />
          <span>Verfügbar</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.public_visible}
            onChange={e => setForm(f => ({ ...f, public_visible: e.target.checked }))}
          />
          <span>Öffentlich vorbereitet (noch keine Wirkung)</span>
        </label>
      </div>

      <div className="field-group">
        <label>Sortierung</label>
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          value={form.sort_order}
          onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
        />
        <p className="field-hint">Niedrigere Zahl = wird zuerst angezeigt</p>
      </div>

      <div className="form-actions-secondary">
        <button
          className="btn"
          data-testid="addon-option-save-btn"
          disabled={saving}
          onClick={onSave}
          type="button"
        >
          {saving ? 'Speichert…' : isNew ? 'Zusatzoption anlegen' : 'Änderungen speichern'}
        </button>
        <button className="btn ghost" onClick={onCancel} type="button">
          Abbrechen
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Hauptkomponente: EventStandPricingSection
// ─────────────────────────────────────────────────────────

export default function EventStandPricingSection({ eventId, notify }) {
  // Daten
  const [standOptions, setStandOptions] = useState([])
  const [priceTiers, setPriceTiers] = useState([])
  const [addonOptions, setAddonOptions] = useState([])
  const [loading, setLoading] = useState(true)

  // Stand-Option Formular
  const [editingOptionId, setEditingOptionId] = useState(null) // null | 'new' | uuid
  const [optionForm, setOptionForm] = useState(emptyOptionForm)
  const [optionSaving, setOptionSaving] = useState(false)

  // Price-Tier Formular
  const [expandedTiersId, setExpandedTiersId] = useState(null)
  const [editingTierId, setEditingTierId] = useState(null) // null | 'new' | uuid
  const [tierParentOptionId, setTierParentOptionId] = useState(null)
  const [tierForm, setTierForm] = useState(emptyTierForm)
  const [tierSaving, setTierSaving] = useState(false)

  // Addon Formular
  const [editingAddonId, setEditingAddonId] = useState(null) // null | 'new' | uuid
  const [addonForm, setAddonForm] = useState(emptyAddonForm)
  const [addonSaving, setAddonSaving] = useState(false)

  // Lösch-Modal
  const [itemToDelete, setItemToDelete] = useState(null) // { type, id, label }
  const [deleting, setDeleting] = useState(false)

  // ── Daten laden ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!eventId) return
    try {
      const [optResult, addonResult] = await Promise.all([
        supabase
          .from('event_stand_options')
          .select('*')
          .eq('event_id', eventId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('event_addon_options')
          .select('*')
          .eq('event_id', eventId)
          .order('sort_order', { ascending: true })
      ])

      if (optResult.error) throw optResult.error
      if (addonResult.error) throw addonResult.error

      const options = optResult.data || []
      setStandOptions(options)
      setAddonOptions(addonResult.data || [])

      const tieredIds = options
        .filter(o => o.pricing_type === 'tiered_length')
        .map(o => o.id)

      if (tieredIds.length > 0) {
        const { data: tiers, error: tierError } = await supabase
          .from('event_stand_price_tiers')
          .select('*')
          .in('stand_option_id', tieredIds)
          .order('sort_order', { ascending: true })

        if (tierError) throw tierError
        setPriceTiers(tiers || [])
      } else {
        setPriceTiers([])
      }
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Standflächendaten konnten nicht geladen werden.'))
    }
  }, [eventId, notify])

  useEffect(() => {
    setLoading(true)
    setEditingOptionId(null)
    setOptionForm(emptyOptionForm())
    setEditingAddonId(null)
    setAddonForm(emptyAddonForm())
    setEditingTierId(null)
    setTierParentOptionId(null)
    setTierForm(emptyTierForm())
    setExpandedTiersId(null)

    loadData().finally(() => setLoading(false))
  }, [eventId, loadData])

  // ── Stand-Option CRUD ────────────────────────────────────

  function startNewOption() {
    setEditingOptionId('new')
    setOptionForm(emptyOptionForm())
  }

  function startEditOption(option) {
    setEditingOptionId(option.id)
    setOptionForm(optionToForm(option))
  }

  function cancelOptionEdit() {
    setEditingOptionId(null)
    setOptionForm(emptyOptionForm())
  }

  async function saveOption() {
    if (!optionForm.label.trim()) {
      notify?.('error', 'Bezeichnung ist Pflicht.')
      return
    }
    setOptionSaving(true)
    try {
      const payload = buildOptionPayload(optionForm, eventId)
      if (editingOptionId === 'new') {
        const { error } = await supabase.from('event_stand_options').insert(payload)
        if (error) throw error
        notify?.('success', 'Standoption angelegt.')
      } else {
        const { error } = await supabase
          .from('event_stand_options')
          .update(payload)
          .eq('id', editingOptionId)
        if (error) throw error
        if (payload.pricing_type !== 'tiered_length' && expandedTiersId === editingOptionId) {
          setExpandedTiersId(null)
        }
        notify?.('success', 'Standoption gespeichert.')
      }
      setEditingOptionId(null)
      setOptionForm(emptyOptionForm())
      await loadData()
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Standoption konnte nicht gespeichert werden.'))
    } finally {
      setOptionSaving(false)
    }
  }

  // ── Price-Tier CRUD ──────────────────────────────────────

  function startNewTier(optionId) {
    setExpandedTiersId(optionId)
    setTierParentOptionId(optionId)
    setEditingTierId('new')
    setTierForm(emptyTierForm())
  }

  function startEditTier(tier) {
    setExpandedTiersId(tier.stand_option_id)
    setTierParentOptionId(tier.stand_option_id)
    setEditingTierId(tier.id)
    setTierForm(tierToForm(tier))
  }

  function cancelTierEdit() {
    setEditingTierId(null)
    setTierParentOptionId(null)
    setTierForm(emptyTierForm())
  }

  async function saveTier() {
    const minL = parseMetric(tierForm.min_length_m)
    const maxL = parseMetric(tierForm.max_length_m)
    if (minL != null && maxL != null && minL > maxL) {
      notify?.('error', 'Min-Länge darf nicht größer als Max-Länge sein.')
      return
    }
    setTierSaving(true)
    try {
      const payload = buildTierPayload(tierForm, tierParentOptionId)
      if (editingTierId === 'new') {
        const { error } = await supabase.from('event_stand_price_tiers').insert(payload)
        if (error) throw error
        notify?.('success', 'Preisbereich angelegt.')
      } else {
        const { error } = await supabase
          .from('event_stand_price_tiers')
          .update(payload)
          .eq('id', editingTierId)
        if (error) throw error
        notify?.('success', 'Preisbereich gespeichert.')
      }
      setEditingTierId(null)
      setTierParentOptionId(null)
      setTierForm(emptyTierForm())
      await loadData()
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Preisbereich konnte nicht gespeichert werden.'))
    } finally {
      setTierSaving(false)
    }
  }

  // ── Addon CRUD ───────────────────────────────────────────

  function startNewAddon() {
    setEditingAddonId('new')
    setAddonForm(emptyAddonForm())
  }

  function startEditAddon(addon) {
    setEditingAddonId(addon.id)
    setAddonForm(addonToForm(addon))
  }

  function cancelAddonEdit() {
    setEditingAddonId(null)
    setAddonForm(emptyAddonForm())
  }

  async function saveAddon() {
    if (!addonForm.label.trim()) {
      notify?.('error', 'Bezeichnung ist Pflicht.')
      return
    }
    setAddonSaving(true)
    try {
      const payload = buildAddonPayload(addonForm, eventId)
      if (editingAddonId === 'new') {
        const { error } = await supabase.from('event_addon_options').insert(payload)
        if (error) throw error
        notify?.('success', 'Zusatzoption angelegt.')
      } else {
        const { error } = await supabase
          .from('event_addon_options')
          .update(payload)
          .eq('id', editingAddonId)
        if (error) throw error
        notify?.('success', 'Zusatzoption gespeichert.')
      }
      setEditingAddonId(null)
      setAddonForm(emptyAddonForm())
      await loadData()
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Zusatzoption konnte nicht gespeichert werden.'))
    } finally {
      setAddonSaving(false)
    }
  }

  // ── Löschen ──────────────────────────────────────────────

  async function confirmDelete() {
    if (!itemToDelete) return
    setDeleting(true)
    try {
      if (itemToDelete.type === 'option') {
        const { error } = await supabase
          .from('event_stand_options')
          .delete()
          .eq('id', itemToDelete.id)
        if (error) throw error
        if (expandedTiersId === itemToDelete.id) setExpandedTiersId(null)
        if (editingOptionId === itemToDelete.id) {
          setEditingOptionId(null)
          setOptionForm(emptyOptionForm())
        }
        notify?.('success', 'Standoption gelöscht. Preisbereiche wurden automatisch entfernt.')
      } else if (itemToDelete.type === 'tier') {
        const { error } = await supabase
          .from('event_stand_price_tiers')
          .delete()
          .eq('id', itemToDelete.id)
        if (error) throw error
        if (editingTierId === itemToDelete.id) {
          setEditingTierId(null)
          setTierForm(emptyTierForm())
        }
        notify?.('success', 'Preisbereich gelöscht.')
      } else if (itemToDelete.type === 'addon') {
        const { error } = await supabase
          .from('event_addon_options')
          .delete()
          .eq('id', itemToDelete.id)
        if (error) throw error
        if (editingAddonId === itemToDelete.id) {
          setEditingAddonId(null)
          setAddonForm(emptyAddonForm())
        }
        notify?.('success', 'Zusatzoption gelöscht.')
      }
      setItemToDelete(null)
      await loadData()
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Löschen ist fehlgeschlagen.'))
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="stand-pricing-wrapper" data-testid="stand-pricing-section">
        <p className="form-section-hint">Standflächendaten werden geladen…</p>
      </div>
    )
  }

  return (
    <div className="stand-pricing-wrapper" data-testid="stand-pricing-section">

      {/* ─── Standoptionen ───────────────────────────────── */}
      <section className="form-section form-section-internal">
        <div className="form-section-header">
          <div className="form-section-header-row">
            <h3 className="form-section-title">Standflächen &amp; Preise</h3>
            <span className="form-visibility-note form-note-internal">Nur intern sichtbar</span>
          </div>
          <p className="form-section-hint">
            Lege buchbare Standflächen an. Preise werden später in der Bewerbung angezeigt, sobald eine
            Public-Read-Policy aktiviert wird.
          </p>
        </div>

        {standOptions.length === 0 && editingOptionId === null && (
          <div className="list-empty-state" data-testid="stand-pricing-empty-options">
            <strong>Noch keine Standflächen hinterlegt.</strong>
            <p className="muted">
              Lege Standoptionen an, damit Preise später in der Bewerbung angezeigt werden können.
            </p>
          </div>
        )}

        <div className="stand-option-list" data-testid="stand-option-list">
          {standOptions.map(option => (
            <div className="stand-option-row" key={option.id} data-testid="stand-option-item">
              <div className="stand-option-row-summary">
                <div className="stand-option-row-info">
                  <strong>{option.label}</strong>
                  <div className="stand-option-row-badges">
                    <span className="pill info-pill">
                      {AREA_TYPE_LABELS[option.area_type] ?? option.area_type}
                    </span>
                    <span className="pill info-pill">
                      {PRICING_TYPE_LABELS[option.pricing_type] ?? option.pricing_type}
                    </span>
                    {option.is_available ? (
                      <span className="pill ok">Verfügbar</span>
                    ) : (
                      <span className="pill status-visibility-internal">Nicht verfügbar</span>
                    )}
                    {option.public_visible && (
                      <span className="pill info-pill">Öffentl. vorbereitet</span>
                    )}
                  </div>
                  <span className="field-hint" data-testid="stand-option-price-display">
                    {formatOptionPrice(option)}
                  </span>
                  {option.surface_types?.length > 0 && (
                    <span className="field-hint">
                      Untergrund:{' '}
                      {option.surface_types
                        .map(s => SURFACE_TYPES.find(st => st.value === s)?.label ?? s)
                        .join(', ')}
                    </span>
                  )}
                </div>
                <div className="stand-option-row-actions">
                  <button
                    className="btn ghost"
                    data-testid="stand-option-edit-btn"
                    onClick={() =>
                      editingOptionId === option.id ? cancelOptionEdit() : startEditOption(option)
                    }
                    type="button"
                  >
                    {editingOptionId === option.id ? 'Abbrechen' : 'Bearbeiten'}
                  </button>
                  <button
                    className="btn danger-outline"
                    data-testid="stand-option-delete-btn"
                    onClick={() =>
                      setItemToDelete({ type: 'option', id: option.id, label: option.label })
                    }
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {editingOptionId === option.id && (
                <OptionForm
                  form={optionForm}
                  setForm={setOptionForm}
                  onSave={saveOption}
                  onCancel={cancelOptionEdit}
                  saving={optionSaving}
                  isNew={false}
                />
              )}

              {option.pricing_type === 'tiered_length' && editingOptionId !== option.id && (
                <PriceTiersBlock
                  option={option}
                  tiers={priceTiers.filter(t => t.stand_option_id === option.id)}
                  expanded={expandedTiersId === option.id}
                  onToggle={() =>
                    setExpandedTiersId(id => (id === option.id ? null : option.id))
                  }
                  editingTierId={editingTierId}
                  tierParentOptionId={tierParentOptionId}
                  tierForm={tierForm}
                  setTierForm={setTierForm}
                  onNewTier={() => startNewTier(option.id)}
                  onEditTier={startEditTier}
                  onSaveTier={saveTier}
                  onCancelTier={cancelTierEdit}
                  tierSaving={tierSaving}
                  onDeleteTier={tier =>
                    setItemToDelete({ type: 'tier', id: tier.id, label: tier.label || 'Preisbereich' })
                  }
                />
              )}
            </div>
          ))}
        </div>

        {editingOptionId === 'new' && (
          <div className="stand-option-row">
            <OptionForm
              form={optionForm}
              setForm={setOptionForm}
              onSave={saveOption}
              onCancel={cancelOptionEdit}
              saving={optionSaving}
              isNew
            />
          </div>
        )}

        <div className="stand-pricing-section-actions">
          {editingOptionId === null && (
            <button
              className="btn secondary"
              data-testid="stand-option-add-btn"
              onClick={startNewOption}
              type="button"
            >
              <Plus size={16} /> Neue Standoption
            </button>
          )}
        </div>
      </section>

      {/* ─── Zusatzoptionen ──────────────────────────────── */}
      <section className="form-section form-section-internal">
        <div className="form-section-header">
          <div className="form-section-header-row">
            <h3 className="form-section-title">Zusatzoptionen</h3>
            <span className="form-visibility-note form-note-internal">Nur intern sichtbar</span>
          </div>
          <p className="form-section-hint">
            Strom, Wasser oder weitere buchbare Leistungen für Aussteller.
          </p>
        </div>

        {addonOptions.length === 0 && editingAddonId === null && (
          <div className="list-empty-state" data-testid="stand-pricing-empty-addons">
            <strong>Noch keine Zusatzoptionen hinterlegt.</strong>
            <p className="muted">
              Strom, Wasser oder weitere Leistungen können später ergänzt werden.
            </p>
          </div>
        )}

        <div className="stand-option-list" data-testid="addon-option-list">
          {addonOptions.map(addon => (
            <div className="stand-option-row" key={addon.id} data-testid="addon-option-item">
              <div className="stand-option-row-summary">
                <div className="stand-option-row-info">
                  <strong>{addon.label}</strong>
                  <div className="stand-option-row-badges">
                    <span className="pill info-pill">
                      {ADDON_TYPES.find(t => t.value === addon.addon_type)?.label ?? addon.addon_type}
                    </span>
                    {addon.is_available ? (
                      <span className="pill ok">Verfügbar</span>
                    ) : (
                      <span className="pill status-visibility-internal">Nicht verfügbar</span>
                    )}
                  </div>
                  <span className="field-hint" data-testid="addon-option-price-display">
                    {formatAddonPrice(addon)}
                  </span>
                </div>
                <div className="stand-option-row-actions">
                  <button
                    className="btn ghost"
                    data-testid="addon-option-edit-btn"
                    onClick={() =>
                      editingAddonId === addon.id ? cancelAddonEdit() : startEditAddon(addon)
                    }
                    type="button"
                  >
                    {editingAddonId === addon.id ? 'Abbrechen' : 'Bearbeiten'}
                  </button>
                  <button
                    className="btn danger-outline"
                    data-testid="addon-option-delete-btn"
                    onClick={() =>
                      setItemToDelete({ type: 'addon', id: addon.id, label: addon.label })
                    }
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {editingAddonId === addon.id && (
                <AddonForm
                  form={addonForm}
                  setForm={setAddonForm}
                  onSave={saveAddon}
                  onCancel={cancelAddonEdit}
                  saving={addonSaving}
                  isNew={false}
                />
              )}
            </div>
          ))}
        </div>

        {editingAddonId === 'new' && (
          <div className="stand-option-row">
            <AddonForm
              form={addonForm}
              setForm={setAddonForm}
              onSave={saveAddon}
              onCancel={cancelAddonEdit}
              saving={addonSaving}
              isNew
            />
          </div>
        )}

        <div className="stand-pricing-section-actions">
          {editingAddonId === null && (
            <button
              className="btn secondary"
              data-testid="addon-option-add-btn"
              onClick={startNewAddon}
              type="button"
            >
              <Plus size={16} /> Neue Zusatzoption
            </button>
          )}
        </div>
      </section>

      {/* ─── Lösch-Bestätigung ───────────────────────────── */}
      <ConfirmModal
        busy={deleting}
        message={
          itemToDelete?.type === 'option'
            ? `„${itemToDelete?.label}" wird gelöscht. Alle zugehörigen Preisbereiche werden automatisch entfernt.`
            : `„${itemToDelete?.label}" wird gelöscht.`
        }
        onCancel={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        open={Boolean(itemToDelete)}
        testId="delete-stand-item-modal"
        title={
          itemToDelete?.type === 'option'
            ? 'Standoption wirklich löschen?'
            : itemToDelete?.type === 'tier'
              ? 'Preisbereich wirklich löschen?'
              : 'Zusatzoption wirklich löschen?'
        }
      />
    </div>
  )
}
