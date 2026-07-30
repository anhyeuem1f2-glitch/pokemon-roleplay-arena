import React from 'react'

const frames = [
  '/retro-intro/frame1.png',
  '/retro-intro/frame2.png',
  '/retro-intro/frame3.png',
]

export default function RetroBattleIntro({ active, dimmed }) {
  return (
    <div className={`retro-intro ${active ? 'retro-intro--active' : ''} ${dimmed ? 'retro-intro--dimmed' : ''}`} aria-hidden="true">
      <div className="retro-intro__shell">
        <div className="retro-intro__screen">
          {frames.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`retro-intro__frame retro-intro__frame--${index + 1}`}
              draggable="false"
            />
          ))}
          <div className="retro-intro__flash" />
          <div className="retro-intro__vignette" />
        </div>
      </div>
    </div>
  )
}
