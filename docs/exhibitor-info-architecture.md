# Architekturhinweis: Ausstellerinfos

## Datenquellen

- `public.events` enthaelt nur allgemeine Eventdaten.
- `public.event_exhibitor_info` enthaelt interne operative Ausstellerinfos.

## Sicherheitsregel

- `public.event_exhibitor_info` ist organizer-only ueber RLS geschuetzt.
- Public Pages duerfen diese Tabelle nicht lesen oder anzeigen.
- Sensible operative Angaben gehoeren nicht in `public.events`.

## Was zu `public.events` gehoert

Beispiele fuer allgemeine Eventdaten:
- Eventname
- Datum
- Ort
- Oeffnungszeiten
- oeffentliche Eventbeschreibung
- allgemeine Merkmale wie Parken, WC, Gastronomie, Indoor/Outdoor

## Was zu `public.event_exhibitor_info` gehoert

Alle internen operativen Ausstellerinfos, zum Beispiel:
- Aufbau von / bis
- Abbau von / bis
- Anfahrtshinweise
- Einfahrt / Zufahrt
- Ansprechpartner vor Ort
- Notfallkontakt
- Stromhinweise
- Parkhinweise
- Muell / Entsorgung
- weitere interne Hinweise fuer Aussteller

## Wichtige Entwicklungsregel

- Neue Features fuer Aufbau, Anreise, Zufahrt, Kontakte, Notfallkontakt oder Logistik muessen immer `public.event_exhibitor_info` verwenden.
- Alte testweise Ausstellerinfo-Spalten auf `public.events` wurden bewusst verworfen und duerfen nicht wieder eingefuehrt werden.
- Wenn operative Ausstellerinfos in neuen UI-Flows gebraucht werden, duerfen sie nur aus `public.event_exhibitor_info` geladen und gespeichert werden.

## Setup- und Schema-Hinweis

- Fuer frische Setups muss `public.event_exhibitor_info` ueber die aktuellen Schema-Dateien oder ueber `supabase/event_exhibitor_info.sql` vorhanden sein.
- `supabase/event_exhibitor_info.sql` ist die eigenstaendige Referenzdatei fuer die Tabelle `public.event_exhibitor_info`.
- `supabase/schema.sql` und `supabase/public_product_core.sql` enthalten die Zielstruktur fuer die aktuelle Architektur.
- Public-/Platform-SQL darf keine internen Ausstellerinfo-Felder mehr direkt auf `public.events` anlegen.
- Die fruehere Datei `supabase/event_exhibitor_info_fields.sql` war der verworfene Altpfad ueber `public.events` und darf nicht wiederhergestellt werden.

## Do / Don't fuer neue Entwickler

Do:
- Interne Ausstellerinformationen ausschliesslich ueber `public.event_exhibitor_info` abbilden.
- Bei frischen Setups sicherstellen, dass `supabase/event_exhibitor_info.sql` beruecksichtigt wird.
- `supabase/schema.sql` und `supabase/public_product_core.sql` als Zielstruktur beachten.
- Oeffentliche Eventdaten und interne Ausstellerinformationen klar trennen.
- Public Pages nur mit oeffentlichen Event- und Haendlerdaten versorgen.

Don't:
- Keine internen Ausstellerinfo-Felder direkt auf `public.events` anlegen.
- `supabase/event_exhibitor_info_fields.sql` nicht wiederherstellen.
- Keine Public-/Platform-SQL-Dateien verwenden, um interne Ausstellerinfos auf `events` zu erweitern.
- Keine internen Ausstellerinformationen auf Public Pages sichtbar machen.
- Keine neue Parallelstruktur fuer dieselben Daten anlegen.
