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
