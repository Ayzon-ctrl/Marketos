import { Link, NavLink, Outlet } from 'react-router-dom'
import { publicNav } from '../../lib/navigation'

export default function PublicLayout({ session }) {
  return (
    <div className="public-shell" data-testid="public-shell">
      <header className="public-header" data-testid="public-header">
        <div className="public-header-inner">
          <Link className="public-brand" to="/">
            <span className="public-brand-mark">M</span>
            <span>
              <strong>MarketOS</strong>
              <small>Marktplattform</small>
            </span>
          </Link>

          <nav className="public-nav" aria-label="Öffentliche Navigation">
            {publicNav.map(item => (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
                data-testid={`public-nav-${item.key}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Link
            className="btn ghost public-login-button public-utility-button"
            to={session ? '/app' : '/login'}
            data-testid={session ? 'public-nav-dashboard' : 'public-nav-login'}
          >
            {session ? 'Dashboard' : 'Login'}
          </Link>
        </div>
      </header>

      <main className="public-main">
        <Outlet context={{ session }} />
      </main>

      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="public-footer-brand">
            <strong>MarketOS</strong>
            <p className="muted">Öffentliche Marktplattform für Märkte, Events und Händler.</p>
          </div>

          <div className="public-footer-links">
            <Link to="/contact">Kontakt</Link>
            <Link to="/imprint">Impressum</Link>
            <Link to="/terms">AGB</Link>
            <Link to="/withdrawal">Widerrufsbelehrung</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
