# Promotions Vorbereitung

## Ziel

Promotions sind später kostenpflichtige Hervorhebungen für:

- Märkte / Events
- Händlerprofile

Aktuell wird nur die Struktur vorbereitet. Es gibt noch:

- keinen Stripe Checkout
- keine Checkout-Session
- keine Webhooks
- keine automatische Aktivierung

## Grundregel

Eine Promotion darf öffentlich nur sichtbar sein, wenn:

- `status = 'active'`
- `payment_status = 'paid'`
- `starts_at` leer oder bereits erreicht ist
- `ends_at` leer oder noch nicht abgelaufen ist

## Zahlung später

Die spätere Zahlung muss serverseitig bestätigt werden.

- Frontend darf niemals selbst `payment_status = 'paid'` setzen
- Stripe Checkout oder ein anderer Provider darf nur serverseitig erzeugt werden
- Webhooks setzen nach bestätigter Zahlung den finalen Zahlungsstatus

## Spätere Architektur

1. Veranstalter oder Händler startet serverseitig einen Kaufprozess
2. Server erstellt Checkout-Session
3. Provider sendet Webhook nach erfolgreicher Zahlung
4. Backend setzt:
   - `payment_status = 'paid'`
   - danach erst `status = 'active'`
5. Public-Frontend zeigt aktive Promotions automatisch an

## Wichtige Sicherheitsregel

Das Frontend darf:

- Promotions lesen, wenn sie öffentlich aktiv sind
- eigene Draft-/Pending-Promotions später im Dashboard sehen

Das Frontend darf nicht:

- Zahlungen bestätigen
- aktive Promotions ohne Bezahlung freischalten
- Provider-IDs als Erfolgsnachweis interpretieren
