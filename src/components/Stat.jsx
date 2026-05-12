export default function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card stat">
      <div>
        <div className="muted small">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div className="stat-icon">
        <Icon size={22} />
      </div>
    </div>
  )
}
