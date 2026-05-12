# Deployment auf Vercel

## Voraussetzungen
- GitHub-Repository mit dem aktuellen Stand von MarketOS
- Supabase-Projekt mit ausgefuehrten Migrationen
- Vercel-Account

## Benoetigte Environment Variablen
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Wichtige Sicherheitsregeln
- Niemals einen Supabase Service Role Key ins Frontend legen
- Keine Secrets committen
- `.env`, `.env.local` und `.env.*.local` bleiben lokal

## Vercel Build Settings
- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

## Supabase Auth Konfiguration
In Supabase unter Authentication > URL Configuration:

### Site URL
- lokal: `http://127.0.0.1:5173`
- spaeter produktiv: `https://<deine-vercel-domain>`

### Redirect URLs
- `http://127.0.0.1:5173`
- `http://localhost:5173`
- `https://<deine-vercel-domain>`
- optional Preview Deployments: `https://<dein-projekt>-*.vercel.app`

Wichtig: Nach dem Deployment muss der Login auf der Vercel-Domain noch einmal praktisch geprueft werden.
