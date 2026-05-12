// F3: Interne Preisvorschau für Aussteller (read-only, kein CRUD, kein Public-Bezug)

import {
  ADDON_TYPE_LABELS,
  AREA_TYPE_LABELS,
  SURFACE_TYPE_LABELS,
  centsToEuroStr,
  formatPricingLines,
  formatTierLine
} from '../../lib/standPricingUtils'

// ─────────────────────────────────────────────────────────
// Sub-Komponente: einzelne Standoption
// ─────────────────────────────────────────────────────────

function StandOptionCard({ option, tiers }) {
  const isTiered = option.pricing_type === 'tiered_length'
  const pricingLines = isTiered ? null : formatPricingLines(option)
  const areaLabel = AREA_TYPE_LABELS[option.area_type] ?? option.area_type
  const surfaceLabels = (option.surface_types || [])
    .map(s => SURFACE_TYPE_LABELS[s] ?? s)
    .join(', ')

  return (
    <div className="item" data-testid="event-stand-pricing-preview-option">
      <div className="row space-between" style={{ alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <strong data-testid="event-stand-pricing-preview-option-label">{option.label}</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="pill info-pill">{areaLabel}</span>
          {!option.is_available && (
            <span className="pill status-visibility-internal">Nicht verfügbar</span>
          )}
        </div>
      </div>

      {/* Preiszeilen */}
      {isTiered ? (
        <div style={{ marginTop: 6 }}>
          {tiers.length === 0 ? (
            <p className="muted small" data-testid="event-stand-pricing-preview-tier-empty">
              Noch keine Preisbereiche hinterlegt.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
              {tiers.map((tier, idx) => (
                <p
                  className="muted small"
                  data-testid="event-stand-pricing-preview-tier"
                  key={tier.id ?? idx}
                >
                  {formatTierLine(tier)}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        pricingLines && pricingLines.length > 0 && (
          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
            {pricingLines.map((line, idx) => (
              <p
                className="muted small"
                data-testid="event-stand-pricing-preview-price"
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
              >
                {line}
              </p>
            ))}
          </div>
        )
      )}

      {surfaceLabels && (
        <p className="muted small" style={{ marginTop: 4 }}>
          Untergrund: {surfaceLabels}
        </p>
      )}
      {option.surface_notes && (
        <p className="muted small" style={{ marginTop: 2 }}>
          Hinweis: {option.surface_notes}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Sub-Komponente: einzelne Zusatzoption
// ─────────────────────────────────────────────────────────

function AddonCard({ addon }) {
  const typeLabel = ADDON_TYPE_LABELS[addon.addon_type] ?? addon.addon_type
  const priceText = addon.is_price_on_request
    ? 'Preis auf Anfrage'
    : addon.price_cents != null
      ? `${centsToEuroStr(addon.price_cents)} €`
      : '–'

  return (
    <div className="item" data-testid="event-stand-pricing-preview-addon">
      <div className="row space-between" style={{ alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <strong data-testid="event-stand-pricing-preview-addon-label">{addon.label}</strong>
          <p className="muted small">{typeLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="pill info-pill" data-testid="event-stand-pricing-preview-addon-price">
            {priceText}
          </span>
          {!addon.is_available && (
            <span className="pill status-visibility-internal">Nicht verfügbar</span>
          )}
        </div>
      </div>
      {addon.description && (
        <p className="muted small" style={{ marginTop: 4 }}>
          {addon.description}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Hauptkomponente: EventStandPricingPreview
// Props: standOptions, priceTiers, addonOptions (alle Arrays)
// Keine Interaktion, kein CRUD, keine öffentliche Anzeige.
// ─────────────────────────────────────────────────────────

export default function EventStandPricingPreview({
  standOptions = [],
  priceTiers = [],
  addonOptions = []
}) {
  const hasOptions = standOptions.length > 0
  const hasAddons = addonOptions.length > 0
  const hasAnything = hasOptions || hasAddons

  return (
    <div className="item detail-column" data-testid="event-stand-pricing-preview">
      <div>
        <h4 className="section-title">Preisvorschau für Aussteller</h4>
        <p className="small muted">
          Interne Vorschau der hinterlegten Standflächen und Zusatzoptionen. Noch nicht öffentlich
          sichtbar.
        </p>
      </div>

      <div className="detail-list">
        {/* Leerzustand: gar nichts hinterlegt */}
        {!hasAnything && (
          <div className="item" data-testid="event-stand-pricing-preview-empty">
            <p className="muted small">Noch keine Standflächen oder Zusatzoptionen hinterlegt.</p>
            <p className="muted small" style={{ marginTop: 4 }}>
              Pflege diese Angaben im Eventformular unter Standflächen &amp; Preise.
            </p>
          </div>
        )}

        {/* Standoptionen */}
        {hasOptions && (
          <>
            <div className="item" data-testid="event-stand-pricing-preview-options-header">
              <strong>Standflächen</strong>
            </div>
            {standOptions.map(option => (
              <StandOptionCard
                key={option.id}
                option={option}
                tiers={priceTiers.filter(t => t.stand_option_id === option.id)}
              />
            ))}
          </>
        )}

        {/* Standoptionen-Leerzustand wenn nur Addons vorhanden */}
        {!hasOptions && hasAddons && (
          <div className="item" data-testid="event-stand-pricing-preview-options-empty">
            <strong>Standflächen</strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              Noch keine Standflächen hinterlegt.
            </p>
          </div>
        )}

        {/* Zusatzoptionen */}
        {hasAddons && (
          <>
            <div className="item" data-testid="event-stand-pricing-preview-addons-header">
              <strong>Zusatzoptionen</strong>
            </div>
            {addonOptions.map(addon => (
              <AddonCard key={addon.id} addon={addon} />
            ))}
          </>
        )}

        {/* Zusatzoptionen-Leerzustand wenn nur Standoptionen vorhanden */}
        {!hasAddons && hasOptions && (
          <div className="item" data-testid="event-stand-pricing-preview-addons-empty">
            <strong>Zusatzoptionen</strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              Noch keine Zusatzoptionen hinterlegt.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
