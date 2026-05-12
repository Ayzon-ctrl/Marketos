# MarketOS KI Chat Setup

## Enthalten

- Neuer Menüpunkt: **KI Chat**
- Chat UI im Dashboard
- Lokaler Fallback-Assistent, der sofort ohne API-Key funktioniert
- Supabase Edge Function `market-ai-chat` für echte OpenAI-Antworten

## Lokal testen

```bash
npm install
npm run dev
```

Dann im Dashboard links **KI Chat** öffnen.

## OpenAI über Supabase Edge Function aktivieren

### 1. Supabase CLI installieren

```bash
npm install -g supabase
```

### 2. Projekt verbinden

```bash
supabase login
supabase link --project-ref your-project-ref
```

### 3. OpenAI API-Key als Secret setzen

```bash
supabase secrets set OPENAI_API_KEY=dein_openai_api_key
```

### 4. Function deployen

```bash
supabase functions deploy market-ai-chat
```

Den OpenAI API-Key niemals ins Frontend oder in `.env.local` schreiben. Der Key gehört nur in Supabase Function Secrets.
