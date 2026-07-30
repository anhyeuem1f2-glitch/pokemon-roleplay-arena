import React from 'react'

export default function RetroBattleIntro({ active, dimmed }) {
  return (
    <div className={`retro-intro ${active ? 'retro-intro--active' : ''} ${dimmed ? 'retro-intro--dimmed' : ''}`} aria-hidden="true">
      <div className="retro-intro__shell">
        <div className="retro-intro__screen">
          <img
            src="/retro-intro/intro-battle.webp"
            alt=""
            className="retro-intro__media"
            draggable="false"
            loading="eager"
          />
          <div className="retro-intro__scanlines" />
        </div>
      </div>
    </div>
  )
}
