import { Mail, MapPin, Phone } from 'lucide-react'
import { useMemo, useState } from 'react'

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  message: ''
}

function buildMailto({ firstName, lastName, email, message }) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const subject = fullName ? `Anfrage von ${fullName}` : 'Anfrage über MarketOS'
  const body = [`Name: ${fullName || '-'}`, `E-Mail: ${email || '-'}`, '', 'Nachricht:', message || '-'].join('\n')

  return `mailto:e.stuth@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function PublicContactPage() {
  const [form, setForm] = useState(initialForm)
  const mailtoHref = useMemo(() => buildMailto(form), [form])

  function handleChange(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  return (
    <div className="public-page" data-testid="public-contact-page">
      <section className="public-section-heading heroish">
        <div>
          <h1>Kontakt</h1>
          <p className="muted">
            Wenn Sie Fragen zu MarketOS, Märkten oder einer Zusammenarbeit haben, können Sie uns hier
            direkt eine Nachricht vorbereiten.
          </p>
        </div>
      </section>

      <section className="public-detail-hero public-legal-layout">
        <article className="public-legal-card">
          <h2>Kontaktformular</h2>
          <p className="muted">
            Die Nachricht wird in Ihrem E-Mail-Programm vorbereitet. So müssen wir hier keine
            zusätzlichen sensiblen Formulardaten serverseitig verarbeiten.
          </p>

          <div className="public-contact-form">
            <div className="form-grid">
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  name="lastName"
                  onChange={handleChange}
                  placeholder="Ihr Nachname"
                  type="text"
                  value={form.lastName}
                />
              </label>

              <label className="field">
                <span>Vorname</span>
                <input
                  className="input"
                  name="firstName"
                  onChange={handleChange}
                  placeholder="Ihr Vorname"
                  type="text"
                  value={form.firstName}
                />
              </label>
            </div>

            <label className="field">
              <span>E-Mail Adresse</span>
              <input
                className="input"
                name="email"
                onChange={handleChange}
                placeholder="name@beispiel.de"
                type="email"
                value={form.email}
              />
            </label>

            <label className="field">
              <span>Nachricht</span>
              <textarea
                name="message"
                onChange={handleChange}
                placeholder="Womit können wir helfen?"
                value={form.message}
              />
            </label>

            <div className="public-hero-actions">
              <a className="btn" href={mailtoHref}>
                Nachricht per E-Mail öffnen
              </a>
              <a className="btn secondary" href="mailto:e.stuth@gmail.com">
                Direkt an e.stuth@gmail.com
              </a>
            </div>
          </div>
        </article>

        <aside className="public-legal-card public-contact-card">
          <h2>Direkt erreichbar</h2>
          <div className="public-legal-stack">
            <p className="public-meta-line">
              <Phone size={16} />
              <a href="tel:+4917617285926">+49 176 17285926</a>
            </p>
            <p className="public-meta-line">
              <Mail size={16} />
              <a href="mailto:e.stuth@gmail.com">e.stuth@gmail.com</a>
            </p>
            <p className="public-meta-line">
              <MapPin size={16} />
              Winkelhauser Strasse 59, 47228 Duisburg
            </p>
          </div>
        </aside>
      </section>
    </div>
  )
}
