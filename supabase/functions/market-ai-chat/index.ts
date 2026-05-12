import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://marketos-beta.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
])

const ALLOWED_ROLES = new Set(['organizer', 'exhibitor', 'both', 'visitor'])
const MAX_QUESTION_LENGTH = 1000
const MAX_CONTEXT_BYTES = 50 * 1024
const MAX_REQUEST_BYTES = 60 * 1024
const GENERIC_ERROR_MESSAGE = 'Die Anfrage konnte nicht verarbeitet werden.'

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function getCorsHeaders(origin: string | null) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  })

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  return headers
}

function jsonResponse(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  const headers = getCorsHeaders(origin)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
}

function extractBearerToken(authHeader: string | null) {
  if (!authHeader) return ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

function getSupabaseConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseAnonKey =
    Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new HttpError(500, 'Supabase-Konfiguration fehlt.')
  }

  return { supabaseUrl, supabaseAnonKey }
}

async function authenticateRequest(token: string) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  })

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile?.id || !ALLOWED_ROLES.has(profile.role)) {
    throw new HttpError(403, 'Forbidden')
  }

  return { user, profile }
}

function validatePayload(rawBody: string) {
  const requestBytes = new TextEncoder().encode(rawBody).length
  if (requestBytes > MAX_REQUEST_BYTES) {
    throw new HttpError(413, 'Payload too large')
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }

  if (!payload || typeof payload !== 'object') {
    throw new HttpError(400, 'Invalid payload')
  }

  const questionValue = Reflect.get(payload, 'question')
  const contextValue = Reflect.get(payload, 'context') ?? {}

  if (typeof questionValue !== 'string') {
    throw new HttpError(400, 'Invalid question')
  }

  const question = questionValue.trim()
  if (!question) {
    throw new HttpError(400, 'Question required')
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    throw new HttpError(400, 'Question too long')
  }

  const contextJson = JSON.stringify(contextValue ?? {})
  const contextBytes = new TextEncoder().encode(contextJson).length
  if (contextBytes > MAX_CONTEXT_BYTES) {
    throw new HttpError(413, 'Payload too large')
  }

  return { question, context: contextValue }
}

Deno.serve(async req => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return new Response('forbidden', { status: 403, headers: corsHeaders })
    }
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: GENERIC_ERROR_MESSAGE }, 405, origin)
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ error: GENERIC_ERROR_MESSAGE }, 403, origin)
  }

  try {
    const token = extractBearerToken(req.headers.get('Authorization'))
    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401, origin)
    }

    await authenticateRequest(token)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new HttpError(500, 'Provider configuration missing')
    }

    const rawBody = await req.text()
    const { question, context } = validatePayload(rawBody)
    const system =
      'Du bist der MarketOS-Assistent für ein deutschsprachiges Dashboard für Märkte und Events. Antworte kurz, direkt und operativ. Nutze nur die gelieferten Dashboard-Daten. Wenn Daten fehlen, sage klar, was fehlt. Fokus: Events, Teilnehmer, offene Zahlungen, ToDos, Mitteilungen, E-Mail-Vorlagen, Bewertungen und Verträge.'

    // TODO: Vor Aktivierung ein echtes serverseitiges Rate-Limit ergänzen.
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: system },
          { role: 'user', content: `Frage: ${question}\n\nDashboard-Daten:\n${JSON.stringify(context, null, 2)}` }
        ]
      })
    })

    if (!response.ok) {
      throw new HttpError(502, 'Upstream provider error')
    }

    const data = await response.json()
    const answer = data.output_text || data.output?.[0]?.content?.[0]?.text || 'Keine Antwort erhalten.'

    return jsonResponse({ answer }, 200, origin)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const name = error instanceof Error ? error.name : 'UnknownError'
    console.error('market-ai-chat request failed', { status, name })
    return jsonResponse({ error: GENERIC_ERROR_MESSAGE }, status, origin)
  }
})
