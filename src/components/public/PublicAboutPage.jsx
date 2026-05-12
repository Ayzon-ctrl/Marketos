export default function PublicAboutPage() {
  return (
    <div className="public-page" data-testid="public-about-page">
      <section className="public-section-heading heroish">
        <div>
          <h1>Über MarketOS</h1>
          <p className="muted">
            MarketOS verbindet öffentliche Sichtbarkeit für Märkte und Händler mit einem geschützten
            Bereich für Organisation, Kommunikation und operative Arbeit.
          </p>
        </div>
      </section>

      <section className="public-explainer-grid">
        <article className="card public-copy-card">
          <h3>Warum public-first?</h3>
          <p>
            Besucher wollen Märkte entdecken, Händler ansehen und Informationen lesen, ohne zuerst ein
            Konto anzulegen. Genau das wird hier zur Startlogik der Plattform.
          </p>
        </article>

        <article className="card public-copy-card">
          <h3>Geschützt bleibt geschützt</h3>
          <p>
            Verwaltungsdaten wie interne ToDos, Zahlungen, Mitteilungen oder private Teilnehmerdaten
            bleiben im Login-Bereich. Öffentlich ist nur, was wirklich öffentlich sein soll.
          </p>
        </article>

        <article className="card public-copy-card">
          <h3>Für kleine Händler gemacht</h3>
          <p>
            Händler können sichtbar werden, ohne dass die Plattform wie eine schwerfällige B2B-Suite
            wirkt. Die öffentliche Seite bleibt leicht, die Verwaltung bleibt klar.
          </p>
        </article>
      </section>
    </div>
  )
}
