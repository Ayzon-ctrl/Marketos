/**
 * analytics.js – Fire-and-forget Tracking-Wrapper
 *
 * Regeln:
 *  - Wirft nie eine Exception (try/catch auf oberster Ebene).
 *  - Loggt nur im DEV-Modus (import.meta.env.DEV).
 *  - Bereinigt die Route client-seitig (doppelte Absicherung zur Server-RPC).
 *  - Umgebung wird automatisch gesetzt ('development' | 'production').
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true

/**
 * Entfernt Query-Parameter und Fragment aus einem Pfad.
 * Begrenzt auf 500 Zeichen. Gibt null zurueck wenn leer oder kein String.
 *
 * @param {string|null|undefined} route
 * @returns {string|null}
 */
export function cleanRoute(route) {
  if (!route || typeof route !== 'string') return null
  const clean = route.split('?')[0].split('#')[0].slice(0, 500)
  return clean || null
}

/**
 * Erstellt eine Session-ID. Bevorzugt crypto.randomUUID(); faellt auf
 * einen Zeit+Zufalls-String zurueck falls die API nicht verfuegbar ist.
 *
 * @returns {string}
 */
export function createSessionId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/**
 * Sendet ein Tracking-Event an die Supabase-RPC `track_event`.
 * Schlaegt nie fehl – Fehler werden nur im DEV-Modus geloggt.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   event_name: string,
 *   area: string,
 *   role_context?: string|null,
 *   session_id?: string|null,
 *   entity_type?: string|null,
 *   entity_id?: string|null,
 *   route?: string|null,
 *   result?: string|null,
 *   metadata?: Record<string, unknown>,
 * }} payload
 * @returns {Promise<void>}
 */
export async function trackEvent(supabase, payload) {
  // Pflichtfelder fehlen → stille Rueckkehr.
  if (!supabase || !payload?.event_name || !payload?.area) {
    if (isDev) {
      console.warn('[analytics] trackEvent: supabase-Client oder Pflichtfelder fehlen', payload)
    }
    return
  }

  try {
    await supabase.rpc('track_event', {
      p_event_name:   String(payload.event_name),
      p_area:         String(payload.area),
      p_role_context: payload.role_context  ?? null,
      p_session_id:   payload.session_id    ?? null,
      p_entity_type:  payload.entity_type   ?? null,
      p_entity_id:    payload.entity_id     ?? null,
      p_route:        cleanRoute(payload.route),
      p_result:       payload.result        ?? null,
      p_metadata:     payload.metadata      ?? {},
      p_environment:  isDev ? 'development' : 'production',
    })
  } catch (err) {
    if (isDev) {
      console.warn('[analytics] trackEvent fehlgeschlagen (nicht kritisch):', err?.message)
    }
    // Niemals rethrow – Tracking darf die Anwendung nicht crashen.
  }
}
