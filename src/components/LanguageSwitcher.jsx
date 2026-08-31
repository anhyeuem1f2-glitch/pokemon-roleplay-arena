import React, { useEffect, useRef, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { UI_LANGUAGES } from '../i18n/uiLanguage.js'

export default function LanguageSwitcher({ compact = false, fixed = false }) {
  const { uiLanguage, setUiLanguage } = useGame()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const current = UI_LANGUAGES.find((entry) => entry.key === uiLanguage) ?? UI_LANGUAGES[0]

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer, true)
    return () => window.removeEventListener('pointerdown', onPointer, true)
  }, [open])

  return (
    <div
      ref={rootRef}
      className={`language-switcher ${fixed ? 'language-switcher--fixed' : ''}`}
      data-ui-language-control="true"
    >
      <button
        type="button"
        className="language-switcher__button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Ngôn ngữ / Language / 语言"
      >
        <span className="language-switcher__globe" aria-hidden="true">🌐</span>
        {!compact && <span>{current.short}</span>}
        <span aria-hidden="true" style={{ fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <div className="language-switcher__menu" role="menu">
          {UI_LANGUAGES.map((entry) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={uiLanguage === entry.key}
              className={`language-switcher__option ${uiLanguage === entry.key ? 'is-active' : ''}`}
              key={entry.key}
              onClick={() => {
                setUiLanguage(entry.key)
                setOpen(false)
              }}
            >
              <span>{uiLanguage === entry.key ? '●' : '○'}</span>
              <span>{entry.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
