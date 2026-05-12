# Prüfung: beschreibung-gebietseinheiten.pdf

Die Datei `beschreibung-gebietseinheiten.pdf` ist die GV-ISys-Beschreibung der Regional- und Gebietseinheiten.

Ergebnis:

- Die PDF beschreibt die Datenfelder und Gebietseinheiten.
- Sie bestätigt, dass GV-ISys für politisch selbstständige Gemeinden unter anderem diese Felder enthält:
  - amtliche Gemeindebezeichnung
  - Postleitzahl für den Sitz der Gemeindeverwaltung
  - AGS / ARS
  - Fläche
  - Einwohnerzahlen
- Die PDF enthält nicht die vollständige Liste aller Gemeinden mit Namen und PLZ.

Saubere Konsequenz:

- Aus dieser PDF kann keine vollständige Städte-/Gemeinde-Datenbank extrahiert werden.
- Für den Import muss die aktuelle GV-ISys-Gemeindedatei von Destatis im Excel- oder GV100-Format verwendet werden.
- Die App und SQL-Struktur sind vorbereitet, um nach `name` oder `postal_code` zu suchen.
