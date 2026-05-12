# MarketOS Supabase V1

Deploybare Vite/React Web-App mit Supabase Auth und Datenbank-Anbindung.

## Enthalten

- E-Mail/Passwort Login und Registrierung
- Profile mit Rolle: Veranstalter, Aussteller oder beides
- Events erstellen
- Teilnehmer verwalten
- ToDos erstellen und abhaken
- Mitteilungen posten
- E-Mail-Vorlagen speichern
- Bewertungen speichern, nur wenn User Teilnehmer des Events ist
- Vertrags-Metadaten speichern
- SQL-Schema mit Row Level Security

## 1. Supabase vorbereiten

1. Supabase Projekt öffnen
2. SQL Editor öffnen
3. Datei `supabase/schema.sql` komplett kopieren
4. In Supabase einfügen
5. Run klicken

## 2. Lokale ENV-Datei anlegen

Datei `.env.local` im Projektordner erstellen:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## 3. Lokal starten

```bash
npm install
npm run dev
```

Dann im Browser die angezeigte lokale URL öffnen.

## 4. Für Vercel deployen

1. Projekt in GitHub hochladen
2. In Vercel "New Project" wählen
3. GitHub Repo importieren
4. Environment Variables eintragen:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

5. Deploy klicken

## 5. Supabase Auth Einstellung

Für schnellen Test:

Supabase -> Authentication -> Sign In / Providers -> Email

- Email Provider aktivieren
- Optional für Tests: "Confirm email" deaktivieren

Für Produktion sollte E-Mail-Bestätigung wieder aktiv sein.

## Nächste sinnvolle Ausbaustufe

- echter Datei-Upload über Supabase Storage
- öffentliche Eventseiten ohne Login
- Zahlungsstatus/Bankabgleich
- E-Mail-Versand über Edge Functions + Resend/Brevo
- Kalender-Sync
- Premium-/Billing-Struktur


## Zusatz: Städte und Datenqualität

1. `supabase/locations.sql` zuerst ausführen, wenn die Tabelle noch nicht vorhanden ist.
2. `supabase/official_locations_import.sql` ausführen, um die Tabelle für den vollständigen Deutschland-Import vorzubereiten.
3. `supabase/data_quality.sql` ausführen. Danach kannst du mit `select * from public.event_validation_issues;` fehlerhafte Events prüfen.
4. Die App zeigt fehlerhafte Events zusätzlich direkt als rotes Datenprüfungsbanner an.

Für "alle Städte in Deutschland" bitte die offizielle GV-ISys/Gemeindeverzeichnis-Datei von Destatis verwenden und nicht manuell pflegen.
## Architekturhinweis: Ausstellerinfos

Die Datenquelle fuer operative interne Ausstellerinfos ist ausschliesslich:

- `public.event_exhibitor_info`

Allgemeine Eventdaten bleiben in:

- `public.events`

Public Pages duerfen keine internen Ausstellerinfos lesen oder anzeigen. Details dazu stehen in:

- [docs/exhibitor-info-architecture.md](docs/exhibitor-info-architecture.md)
