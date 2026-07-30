import React from 'react'

export default function PokemonToggle({ checked, onChange, label, hint, disabled = false, compact = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`pokeball-toggle ${checked ? 'is-on' : 'is-off'} ${compact ? 'pokeball-toggle--compact' : ''}`}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <span className="pokeball-toggle__ball" aria-hidden="true">
        <span className="pokeball-toggle__shell pokeball-toggle__shell--top" />
        <span className="pokeball-toggle__shell pokeball-toggle__shell--bottom" />
        <span className="pokeball-toggle__band" />
        <span className="pokeball-toggle__core">
          <span className="pokeball-toggle__core-inner" />
        </span>
      </span>
      {(label || hint) && (
        <span className="pokeball-toggle__copy">
          <span className="pokeball-toggle__head">
            {label && <span className="pokeball-toggle__label">{label}</span>}
            <span className={`pokeball-toggle__state ${checked ? 'pokeball-toggle__state--on' : 'pokeball-toggle__state--off'}`}>
              {checked ? 'BẬT' : 'TẮT'}
            </span>
          </span>
          {hint && <span className="pokeball-toggle__hint">{hint}</span>}
        </span>
      )}
    </button>
  )
}
