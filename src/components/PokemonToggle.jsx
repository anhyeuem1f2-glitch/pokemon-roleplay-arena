import React from 'react'

export default function PokemonToggle({ checked, onChange, label, hint, disabled = false, compact = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`ui-toggle ${checked ? 'ui-toggle--on' : 'ui-toggle--off'} ${compact ? 'ui-toggle--compact' : ''}`}
    >
      <span className="ui-toggle__track" aria-hidden="true">
        <span className="ui-toggle__thumb" />
      </span>
      {(label || hint) && (
        <span className="ui-toggle__copy">
          <span className="ui-toggle__head">
            {label && <span className="ui-toggle__label">{label}</span>}
            <span className={`ui-toggle__state ${checked ? 'ui-toggle__state--on' : 'ui-toggle__state--off'}`}>
              {checked ? 'Bật' : 'Tắt'}
            </span>
          </span>
          {hint && <span className="ui-toggle__hint">{hint}</span>}
        </span>
      )}
    </button>
  )
}
