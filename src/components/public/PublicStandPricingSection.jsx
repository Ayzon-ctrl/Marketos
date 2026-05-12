// F4.2: Öffentliche Standflächen- und Preis-Anzeige auf Public Event Detail Seite.
// Read-only. Kein CRUD. Kein Bewerbungsformular. Kein CTA in diesem Release.
// Daten kommen ausschließlich über Security-Definer-RPCs (whitelisted Felder).

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

function PublicStandOptionCard({ option, tiers }) {
  const isTiered = option.pricing_type === 'tiered_length'
  const pricingLines = isTiered ? null : formatPricingLines(option)
  const areaLabel = AREA_TYPE_LABELS[option.area_type] ?? option.area_type
  const surfaceLabels = (option.surface_types || [])
    .map(s => SURFACE_TYPE_LABELS[s] ?? s)
    .join(', ')

  return (
    <div className="item" data-testid="public-stand-pricing-option">
      <div className="row space-between" style={{ alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <strong data-testid="public-stand-pricing-option-label">{option.label}</strong>
        <span className="pill info-pill">{areaLabel}</span>
      </div>

      {/* Preiszeilen */}
      {isTiered ? (
        <div style={{ marginTop: 6 }}>
          {tiers.length === 0 ? (
            <p className="muted small" data-testid="public-stand-pricing-tier-empty">
              Preis auf Anfrage
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
              {tiers.map((tier, idx) => (
                <p
                  className="muted small"
                  data-testid="public-stand-pricing-tier"
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
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
                data-testid="public-stand-pricing-price"
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
          {option.surface_notes}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Sub-Komponente: einzelne Zusatzoption
// ─────────────────────────────────────────────────────────

function PublicAddonCard({ addon }) {
  const typeLabel = ADDON_TYPE_LABELS[addon.addon_type] ?? addon.addon_type
  const priceText = addon.is_price_on_request
    ? 'Preis auf Anfrage'
    : addon.price_cents != null
      ? `${centsToEuroStr(addon.price_cents)} €`
      : '–'

  return (
    <div className="item" data-testid="public-stand-pricing-addon">
      <div className="row space-between" style={{ alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <strong data-testid="public-stand-pricing-addon-label">{addon.label}</strong>
          <p className="muted small">{typeLabel}</p>
        </div>
        <span className="pill info-pill" data-testid="public-stand-pricing-addon-price">
          {priceText}
        </span>
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
// Hauptkomponente: PublicStandPricingSection
// Props: standOptions, priceTiers, addonOptions (Arrays aus RPC)
// Wird nur gerendert wenn mindestens eine Option oder ein Addon vorhanden ist.
// ─────────────────────────────────────────────────────────

export default function PublicStandPricingSection({
  standOptions = [],
  priceTiers = [],
  addonOptions = []
}) {
  const hasOptions = standOptions.length > 0
  const hasAddons = addonOptions.length > 0

  if (!hasOptions && !hasAddons) return null

  return (
    <section className="public-section" data-testid="public-stand-pricing-section">
      <div className="public-section-heading">
        <div>
          <h2>Standflächen &amp; Preise</h2>
          <p className="muted">
            Freigegebene Standoptionen und Zusatzleistungen für dieses Event.
          </p>
        </div>
      </div>

      <div className="list">
        {/* Standoptionen */}
        {hasOptions && (
          <>
            <div className="item" data-testid="public-stand-pricing-options-header">
              <strong>Standflächen</strong>
            </div>
            {standOptions.map((option, idx) => (
              <PublicStandOptionCard
                key={option.id ?? idx}
                option={option}
                tiers={priceTiers.filter(t => t.stand_option_id === option.id)}
              />
            ))}
          </>
        )}

        {/* Zusatzoptionen */}
        {hasAddons && (
          <>
            <div className="item" data-testid="public-stand-pricing-addons-header">
              <strong>Zusatzoptionen</strong>
            </div>
            {addonOptions.map((addon, idx) => (
              <PublicAddonCard key={addon.id ?? idx} addon={addon} />
            ))}
          </>
        )}
      </div>
    </section>
  )
}
