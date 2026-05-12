// Gemeinsame Utility-Funktionen für Standpreisanzeige.
// Genutzt von:
//   - src/components/event-detail/EventStandPricingPreview.jsx (interne Vorschau)
//   - src/components/public/PublicStandPricingSection.jsx (öffentliche Anzeige)
//
// Keine React-Abhängigkeiten. Reine Daten- und Formatierungslogik.

// ─────────────────────────────────────────────────────────
// Lookup-Tabellen
// ─────────────────────────────────────────────────────────

export const AREA_TYPE_LABELS = {
  indoor: 'Drinnen',
  outdoor: 'Draußen',
  both: 'Drinnen & draußen',
  covered: 'Überdacht',
  partially_covered: 'Teilweise überdacht'
}

export const SURFACE_TYPE_LABELS = {
  beton: 'Beton',
  pflastersteine: 'Pflastersteine',
  asphalt: 'Asphalt',
  wiese: 'Wiese',
  erde: 'Erde',
  sand: 'Sand',
  schotter: 'Schotter',
  holzboden: 'Holzboden',
  hallenboden: 'Hallenboden',
  unbefestigt: 'Unbefestigt',
  sonstiges: 'Sonstiges'
}

export const ADDON_TYPE_LABELS = {
  electricity: 'Stromanschluss',
  water: 'Wasseranschluss',
  table: 'Tisch',
  chair: 'Stuhl',
  pavilion: 'Pavillon',
  waste_fee: 'Müllpauschale',
  cleaning_fee: 'Reinigungspauschale',
  parking_fee: 'Parkgebühr',
  deposit: 'Kaution',
  other: 'Sonstiges'
}

export const PRICING_TYPE_LABELS = {
  flat: 'Pauschale Standgebühr',
  fixed_size: 'Feste Standgröße',
  up_to_length: 'Bis-Länge / max. Frontlänge',
  per_meter: 'Preis pro lfd. Meter',
  per_sqm: 'Preis pro m²',
  base_plus_extra: 'Grundpreis + Zusatzmeter',
  tiered_length: 'Staffelpreis / Preisbereiche',
  custom: 'Sonderpreis / Freitext'
}

// ─────────────────────────────────────────────────────────
// Cent → Euro-Anzeige
// ─────────────────────────────────────────────────────────

export function centsToEuroStr(cents) {
  if (cents == null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

// ─────────────────────────────────────────────────────────
// Preislogik-Anzeige (pricing_type → lesbare Zeilen)
// Gibt ein Array von Anzeigezeilen zurück, oder null bei tiered_length.
// ─────────────────────────────────────────────────────────

export function formatPricingLines(option) {
  if (option.is_price_on_request) return ['Preis auf Anfrage']

  switch (option.pricing_type) {
    case 'flat':
      return option.price_cents != null
        ? [`Pauschale Standgebühr: ${centsToEuroStr(option.price_cents)} €`]
        : ['Preis auf Anfrage']

    case 'fixed_size': {
      const w = option.width_m != null ? `${option.width_m} m` : null
      const d = option.depth_m != null ? `${option.depth_m} m` : null
      const size = [w, d].filter(Boolean).join(' × ')
      const price = option.price_cents != null ? `${centsToEuroStr(option.price_cents)} €` : null
      const lines = []
      if (size && price) lines.push(`${size}: ${price}`)
      else if (size) lines.push(size)
      else if (price) lines.push(price)
      if (option.max_depth_m != null) lines.push(`Tiefe maximal ${option.max_depth_m} m`)
      return lines.length > 0 ? lines : ['–']
    }

    case 'up_to_length': {
      const lengthPart =
        option.max_length_m != null
          ? `Bis ${option.max_length_m} m Frontlänge`
          : 'Bis max. Frontlänge'
      const pricePart =
        option.price_cents != null
          ? `${centsToEuroStr(option.price_cents)} €`
          : 'Preis auf Anfrage'
      const lines = [`${lengthPart}: ${pricePart}`]
      if (option.max_depth_m != null) lines.push(`Tiefe maximal ${option.max_depth_m} m`)
      return lines
    }

    case 'per_meter':
      return option.price_per_meter_cents != null
        ? [`${centsToEuroStr(option.price_per_meter_cents)} € pro laufendem Meter Frontlänge`]
        : ['Preis auf Anfrage']

    case 'per_sqm':
      return option.price_per_sqm_cents != null
        ? [`${centsToEuroStr(option.price_per_sqm_cents)} € pro m²`]
        : ['Preis auf Anfrage']

    case 'base_plus_extra': {
      const base =
        option.price_cents != null ? `${centsToEuroStr(option.price_cents)} €` : '–'
      const lengthPart =
        option.max_length_m != null
          ? `Bis ${option.max_length_m} m Frontlänge: ${base}`
          : base
      const extraPart =
        option.price_per_extra_meter_cents != null
          ? `, jeder weitere Meter: ${centsToEuroStr(option.price_per_extra_meter_cents)} €`
          : ''
      return [`${lengthPart}${extraPart}`]
    }

    case 'tiered_length':
      return null // Tiers werden separat gerendert

    case 'custom':
      if (option.pricing_description) return [option.pricing_description]
      return ['Preis auf Anfrage']

    default:
      return ['–']
  }
}

// ─────────────────────────────────────────────────────────
// Preisbereich-Anzeige (ein Tier → eine Zeile)
// ─────────────────────────────────────────────────────────

export function formatTierLine(tier) {
  const price = tier.is_price_on_request
    ? 'Preis auf Anfrage'
    : tier.price_cents != null
      ? `${centsToEuroStr(tier.price_cents)} €`
      : '–'

  // Label vorhanden → direkt nutzen
  if (tier.label && String(tier.label).trim()) {
    return `${String(tier.label).trim()}: ${price}`
  }

  // Aus min/max aufbauen
  const hasMin = tier.min_length_m != null
  const hasMax = tier.max_length_m != null

  if (hasMin && hasMax) {
    if (Number(tier.min_length_m) === 0) return `Bis ${tier.max_length_m} m Frontlänge: ${price}`
    return `Über ${tier.min_length_m} m bis ${tier.max_length_m} m Frontlänge: ${price}`
  }
  if (hasMin) return `Ab ${tier.min_length_m} m Frontlänge: ${price}`
  if (hasMax) return `Bis ${tier.max_length_m} m Frontlänge: ${price}`
  return price
}
