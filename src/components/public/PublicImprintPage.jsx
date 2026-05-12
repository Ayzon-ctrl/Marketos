export default function PublicImprintPage() {
  return (
    <div className="public-page" data-testid="public-imprint-page">
      <section className="public-section-heading heroish">
        <div>
          <h1>Impressum</h1>
          <p className="muted">Angaben gemäß § 5 TMG sowie weitere rechtliche Pflichtangaben.</p>
        </div>
      </section>

      <section className="public-legal-layout">
        <article className="card public-legal-card">
          <h2>Verantwortlich für den Inhalt</h2>
          <div className="public-legal-stack">
            <p>Edwin Stuth</p>
            <p>Winkelhauser Strasse 59</p>
            <p>47228 Duisburg</p>
          </div>

          <h2>Kontakt</h2>
          <div className="public-legal-stack">
            <p>
              Telefon: <a href="tel:+4917617285926">+49 176 17285926</a>
            </p>
            <p>
              E-Mail: <a href="mailto:e.stuth@gmail.com">e.stuth@gmail.com</a>
            </p>
          </div>

          <h2>Aufsichtsbehörde</h2>
          <div className="public-legal-stack">
            <p>Stadt Kamp-Lintfort</p>
            <p>Am Rathaus 2</p>
            <p>47475 Kamp-Lintfort</p>
            <p>
              <a href="https://www.kamp-lintfort.de/" rel="noreferrer" target="_blank">
                https://www.kamp-lintfort.de/
              </a>
            </p>
          </div>

          <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </article>
      </section>
    </div>
  )
}
