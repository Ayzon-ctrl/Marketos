# Stripe Vorbereitung

## 1. Stripe Account
- Stripe Account erstellen
- zuerst nur im Testmodus arbeiten

## 2. Produkte vorbereiten
Spaeter in Stripe anlegen:
- Starter monatlich
- Starter jaehrlich
- Pro monatlich
- Pro jaehrlich

## 3. Preis-IDs spaeter als Environment Variablen
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`

## 4. Zielarchitektur
- Checkout nur serverseitig starten
- Webhooks sind Pflicht
- Subscription-Status wird ueber die Datenbank gespiegelt

## 5. Relevante Webhook Events
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 6. Sicherheit
- Niemals dem Frontend bei Zahlungsstatus vertrauen
- Zahlungsstatus nur ueber verifizierte Webhooks bestaetigen
- Keine Stripe Secret Keys im Frontend speichern

## 7. Spaetere Umsetzung
Die Live-Anbindung kann spaeter ueber eine der beiden serverseitigen Varianten erfolgen:
- Vercel API Route
- Supabase Edge Function
