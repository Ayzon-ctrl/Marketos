const DISALLOWED_CHARACTERS = /[\u0000-\u001F\u007F\s]/
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])

export function sanitizeExternalUrl(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) return ''
  if (DISALLOWED_CHARACTERS.test(rawValue)) return ''

  try {
    const url = new URL(rawValue)
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol)) return ''
    if (!url.hostname) return ''
    if (url.username || url.password) return ''
    return url.toString()
  } catch (_error) {
    return ''
  }
}

export function hasSafeExternalUrl(value) {
  return Boolean(sanitizeExternalUrl(value))
}
