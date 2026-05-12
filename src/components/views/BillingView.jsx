const PLAN_LABELS = {
  free: 'Kostenlos',
  trial: 'Testphase',
  starter: 'Starter',
  pro: 'Pro'
}

function getPlanLabel(plan) {
  return PLAN_LABELS[plan] || 'Kostenlos'
}

export default function BillingView({ subscription }) {
  const currentPlan = subscription?.plan || 'free'
  const currentStatus = subscription?.status || 'free'
  const accessLabel = subscription ? getPlanLabel(currentPlan) : 'Kostenloser Zugang'
  const statusLabel = currentStatus === 'trial' ? 'Testphase aktiv' : getPlanLabel(currentStatus)

  return (
    <div className="grid two" data-testid="billing-view">
      <div className="card" data-testid="billing-current-plan">
        <h2>Abrechnung</h2>
        <p className="muted">Beta aktuell kostenlos. Stripe wird später serverseitig angebunden.</p>

        <div className="list">
          <div className="item">
            <strong>Aktueller Zugang</strong>
            <p className="muted">{accessLabel}</p>
          </div>
          <div className="item">
            <strong>Status</strong>
            <p className="muted">{statusLabel}</p>
          </div>
          {subscription?.trial_ends_at && (
            <div className="item">
              <strong>Testphase endet</strong>
              <p className="muted">{String(subscription.trial_ends_at)}</p>
            </div>
          )}
          {subscription?.current_period_ends_at && (
            <div className="item">
              <strong>Aktueller Zeitraum endet</strong>
              <p className="muted">{String(subscription.current_period_ends_at)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card" data-testid="billing-plan-starter">
          <h2>Starter</h2>
          <p className="muted">
            Für kleinere Veranstalter und Händler, die ihre öffentliche Plattform professionell pflegen wollen.
          </p>
          <button className="btn secondary" data-testid="billing-plan-starter-button" type="button">
            Demnächst verfügbar
          </button>
        </div>

        <div className="card" data-testid="billing-plan-pro">
          <h2>Pro</h2>
          <p className="muted">
            Für Teams mit mehreren Events, stärkerer Organisation und späteren Automatisierungen.
          </p>
          <button className="btn secondary" data-testid="billing-plan-pro-button" type="button">
            Demnächst verfügbar
          </button>
        </div>
      </div>
    </div>
  )
}
