import React from 'react'
import { TYPE_COLORS } from '../data/pokemonTypes.js'

export default function TypeBadge({ type }) {
  const color = TYPE_COLORS[type] ?? '#888'
  return (
    <span className="type-badge" style={{ background: color }}>
      {type}
    </span>
  )
}
