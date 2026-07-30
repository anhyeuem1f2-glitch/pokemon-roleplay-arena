import React from 'react'

function GengarSilhouette() {
  return (
    <svg viewBox="0 0 220 180" width="100%" height="100%" aria-hidden="true">
      <g fill="currentColor">
        <path d="M45 138c-8-17-10-34-6-49 4-18 18-34 36-44l4-18 18 14 14-20 12 19 18-18 6 20c18 6 31 19 38 36 8 18 8 40-1 60l-19-11-10 18-23-9-14 17-15-16-25 13-7-20z" />
        <path d="M59 83l-24-16 11 28z" />
        <path d="M159 83l27-10-16 24z" />
        <path d="M89 148l-15 21 22-8z" />
        <path d="M142 149l11 21-18-8z" />
        <circle cx="87" cy="93" r="9" fill="rgba(255,255,255,0.06)" />
        <circle cx="133" cy="93" r="9" fill="rgba(255,255,255,0.06)" />
      </g>
    </svg>
  )
}

function NidorinoSilhouette() {
  return (
    <svg viewBox="0 0 240 180" width="100%" height="100%" aria-hidden="true">
      <g fill="currentColor">
        <path d="M29 132c4-17 15-30 33-37l22-8 18-29 24-8 26 6 18-9 22 5-13 12 11 11-10 12c12 13 18 30 15 48l-28-8-12 20-17-4-14 18-26-6-9-20-22 8-12-11z" />
        <path d="M103 60l14-30 23 4-22 17z" />
        <path d="M161 59l20-22 17 14-24 9z" />
        <path d="M52 118l-24 6 21 13z" />
        <path d="M184 119l25 5-22 12z" />
        <path d="M91 146l-7 22 17-9z" />
        <path d="M145 146l9 22-18-8z" />
        <circle cx="129" cy="89" r="8" fill="rgba(255,255,255,0.06)" />
      </g>
    </svg>
  )
}

export default function RetroBattleIntro({ active, dimmed }) {
  return (
    <div className={`retro-intro ${active ? 'retro-intro--active' : ''} ${dimmed ? 'retro-intro--dimmed' : ''}`} aria-hidden="true">
      <div className="retro-intro__frame">
        <div className="retro-intro__scanlines" />
        <div className="retro-intro__arena" />
        <div className="retro-intro__flash" />
        <div className="retro-intro__label retro-intro__label--left">GENGAR</div>
        <div className="retro-intro__label retro-intro__label--right">NIDORINO</div>
        <div className="retro-intro__fighter retro-intro__fighter--gengar">
          <GengarSilhouette />
        </div>
        <div className="retro-intro__fighter retro-intro__fighter--nidorino">
          <NidorinoSilhouette />
        </div>
        <div className="retro-intro__impact-ring" />
        <div className="retro-intro__impact-star" />
        <div className="retro-intro__caption">A tiny tribute to where the journey began.</div>
      </div>
    </div>
  )
}
