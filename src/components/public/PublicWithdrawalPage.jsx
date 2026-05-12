const withdrawalParagraphs = [
  'Widerrufsrecht für Verbraucher',
  '(Verbraucher ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbstständigen beruflichen Tätigkeit zugerechnet werden können.)',
  'Widerrufsbelehrung',
  'Widerrufsrecht',
  'Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
  'Die Widerrufsfrist beträgt 14 Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat, sofern Sie eine oder mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt haben und diese einheitlich geliefert wird bzw. werden; an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die letzte Ware in Besitz genommen haben bzw. hat, sofern Sie mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt haben und diese getrennt geliefert werden; an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die letzte Teilsendung oder das letzte Stück in Besitz genommen haben bzw. hat, sofern Sie eine Ware bestellt haben, die in mehreren Teilsendungen oder Stücken geliefert wird.',
  'Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.',
  'Magne_ToGo, Edwin Stuth, Fliederstrasse 89, 47475 Kamp-Lintfort, Telefon: 0176 17285926, E-Mail: magnetogo@web.de. Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
  'Folgen des Widerrufs',
  'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen 14 Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.',
  'Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
  'Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.',
  'Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen 14 Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von 14 Tagen absenden.',
  'Sie tragen die unmittelbaren Kosten der Rücksendung der Waren. Die Kosten für eine Rücksendung per Deutsche Post/Paketdienst beliefen sich zuletzt auf ca. 4,50 € bis 7,50 € (für ein Paket bis 5 kg). Die genauen Kosten können Sie bei Ihrem gewählten Versanddienstleister erfragen.',
  'Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.',
  'Ausschluss- bzw. Erlöschensgründe',
  'Das Widerrufsrecht besteht nicht bei Verträgen zur Lieferung von Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch den Verbraucher maßgeblich ist oder die eindeutig auf die persönlichen Bedürfnisse des Verbrauchers zugeschnitten sind; zur Lieferung von Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde; zur Lieferung alkoholischer Getränke, deren Preis bei Vertragsschluss vereinbart wurde, die aber frühestens 30 Tage nach Vertragsschluss geliefert werden können und deren aktueller Wert von Schwankungen auf dem Markt abhängt, auf die der Unternehmer keinen Einfluss hat; zur Lieferung von Zeitungen, Zeitschriften oder Illustrierten mit Ausnahme von Abonnement-Verträgen.',
  'Das Widerrufsrecht erlischt vorzeitig bei Verträgen zur Lieferung versiegelter Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde; zur Lieferung von Waren, wenn diese nach der Lieferung aufgrund ihrer Beschaffenheit untrennbar mit anderen Gütern vermischt wurden; zur Lieferung von Ton- oder Videoaufnahmen oder Computersoftware in einer versiegelten Packung, wenn die Versiegelung nach der Lieferung entfernt wurde.',
  'Muster-Widerrufsformular',
  '(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)',
  'Magne_ToGo, Edwin Stuth, Fliederstrasse 89, 47475 Kamp-Lintfort, E-Mail: magnetogo@web.de',
  'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*):',
  'Bestellt am (*) / erhalten am (*):',
  'Name des/der Verbraucher(s):',
  'Anschrift des/der Verbraucher(s):',
  'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):',
  'Datum: tt.mm.jjjj',
  '(*) Unzutreffendes streichen.'
]

export default function PublicWithdrawalPage() {
  return (
    <div className="public-page" data-testid="public-withdrawal-page">
      <section className="public-section-heading heroish">
        <div>
          <h1>Widerrufsbelehrung</h1>
          <p className="muted">Hinweise zum Widerrufsrecht für Verbraucher sowie das Musterformular.</p>
        </div>
      </section>

      <section className="public-legal-layout">
        <article className="card public-legal-card legal-longform">
          {withdrawalParagraphs.map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      </section>
    </div>
  )
}
