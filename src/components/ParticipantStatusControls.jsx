import { ChevronDown } from 'lucide-react'
import {
  getParticipantStatusClass,
  getParticipantStatusLabel,
  participantStatusOptions
} from '../lib/participantUtils'

export default function ParticipantStatusControls({
  participant,
  onStatusChange,
  onPaymentToggle,
  disabled = false,
  canEdit = true,
  statusTestId = 'participant-status-select',
  paymentTestId = 'participant-paid-toggle',
  layout = 'stacked'
}) {
  const effectiveStatus = participant.status || (participant.paid ? 'bestaetigt' : 'angefragt')
  const paymentLabel = participant.paid ? 'Bezahlt' : 'Offen'

  if (!canEdit) {
    return (
      <div className={`participant-inline-controls participant-inline-controls-${layout}`}>
        <span className={getParticipantStatusClass(effectiveStatus)}>{getParticipantStatusLabel(effectiveStatus)}</span>
        <span className={participant.paid ? 'pill status-payment-paid' : 'pill status-payment-open'}>
          {paymentLabel}
        </span>
      </div>
    )
  }

  return (
    <div className={`participant-inline-controls participant-inline-controls-${layout}`}>
      <label className="participant-pill-select-wrap">
        <span className="sr-only">Teilnehmerstatus</span>
        <select
          className={`${getParticipantStatusClass(effectiveStatus)} participant-pill-select`}
          data-testid={statusTestId}
          disabled={disabled}
          onChange={event => onStatusChange?.(event.target.value)}
          value={effectiveStatus}
        >
          {participantStatusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown className="participant-pill-select-icon" size={14} />
      </label>

      <button
        className={`${participant.paid ? 'pill status-payment-paid' : 'pill status-payment-open'} participant-pill-toggle`}
        data-testid={paymentTestId}
        disabled={disabled}
        onClick={() => onPaymentToggle?.()}
        type="button"
      >
        {paymentLabel}
      </button>
    </div>
  )
}
