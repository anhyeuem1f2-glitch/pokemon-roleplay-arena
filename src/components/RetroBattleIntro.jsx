import React from 'react'

export default function RetroBattleIntro({ active, dimmed, onComplete }) {
  return (
    <div className={`retro-intro ${active ? 'retro-intro--active' : ''} ${dimmed ? 'retro-intro--dimmed' : ''}`} aria-hidden="true">
      <div className="retro-intro__shell">
        <div className="retro-intro__screen">
          <video
            src="/retro-intro/intro-battle.mp4"
            className="retro-intro__media"
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={onComplete}
          />
          <div className="retro-intro__scanlines" />
        </div>
      </div>
    </div>
  )
}
