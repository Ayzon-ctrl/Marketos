export function createUserSafeError(message) {
  const fallback = String(message || 'Etwas ist schiefgelaufen.').trim() || 'Etwas ist schiefgelaufen.'
  const error = new Error(fallback)
  error.userSafe = true
  return error
}

export function getUserErrorMessage(error, fallbackMessage = 'Etwas ist schiefgelaufen.') {
  const fallback = String(fallbackMessage || 'Etwas ist schiefgelaufen.').trim() || 'Etwas ist schiefgelaufen.'
  const message = String(error?.message || '').trim()

  if (error?.userSafe && message) return message
  return fallback
}

/**
 * Gibt eine lesbare Fehlermeldung für Supabase Auth-Fehler zurück.
 *
 * Supabase Auth gibt AuthApiError-Objekte mit einer .message zurück,
 * die direkt nutzerverständlich sind (z. B. "Password should be at least
 * 6 characters."). getUserErrorMessage() gibt diese nicht weiter, weil
 * error.userSafe nicht gesetzt ist. Dieser Helper zeigt Auth-Messages
 * direkt an – ohne rohe Stacktraces oder interne Supabase-Codes.
 *
 * Sicherheitsregel: Nur .message wird übernommen, nie .stack oder .details.
 */
export function getAuthErrorMessage(error, fallbackMessage = 'Aktion fehlgeschlagen.') {
  const fallback = String(fallbackMessage || 'Aktion fehlgeschlagen.').trim() || 'Aktion fehlgeschlagen.'
  const message = String(error?.message || '').trim()

  // Supabase AuthApiError hat __isAuthError: true
  // Wir geben die Message direkt weiter, wenn sie vorhanden und kurz genug ist.
  // Über 200 Zeichen deutet auf interne/technische Details hin → Fallback.
  if (message && message.length <= 200) return message
  return fallback
}
