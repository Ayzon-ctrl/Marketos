export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  busy = false,
  onConfirm,
  onCancel,
  testId = 'confirm-modal'
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" data-testid={testId}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby={`${testId}-title`}>
        <h3 id={`${testId}-title`}>{title}</h3>
        <p className="muted">{message}</p>
        <div className="modal-actions">
          <button
            className="btn ghost"
            data-testid={`${testId}-cancel`}
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            className="btn danger"
            data-testid={`${testId}-confirm`}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Löscht...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
