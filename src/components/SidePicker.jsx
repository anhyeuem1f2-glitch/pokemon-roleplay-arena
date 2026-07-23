import React, { useState, useMemo } from 'react'
import { getBossTier } from '../data/bossTiers.js'

// Chọn 1 loài + level cho 1 bên (dùng chung cho cả người chơi lẫn đối thủ
// trong tab Test Battle) — <select> gõ-để-tìm sẵn có của trình duyệt, đủ
// dùng cho danh sách hơn 1000 loài mà không cần tự viết ô tự động gợi ý.
function SidePicker({ label, species, onChangeSpecies, level, onChangeLevel, pokedexSpecies }) {
  // Ô tìm kiếm (đợt 26): lọc danh sách hơn 1000 loài theo tên trước khi hiện
  // trong <select> — gõ "ho-oh" hay "chariz" là danh sách rút xuống ngay.
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pokedexSpecies
    return pokedexSpecies.filter((s) => s.name.toLowerCase().includes(q) || s.species.includes(q.replace(/[^a-z0-9]/g, '')))
  }, [search, pokedexSpecies])

  // Nếu loài được chọn là huyền thoại/huyền ảo (nằm trong BOSS_TIERS), thanh
  // trượt level phải cho phép lên tới trần của bậc đó (120/150/200) thay vì
  // luôn giới hạn cứng ở 100 như Pokémon thường.
  const tier = species ? getBossTier(species.name) : null
  const maxLevel = tier ? tier.maxLevel : 100

  function handleSpeciesChange(e) {
    const found = pokedexSpecies.find((s) => s.species === e.target.value)
    onChangeSpecies(found ?? null)
    const foundTier = found ? getBossTier(found.name) : null
    const newMax = foundTier ? foundTier.maxLevel : 100
    if (level > newMax) onChangeLevel(newMax)
  }

  return (
    <div className="field">
      <label>{label}</label>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          // Gõ tới khi chỉ còn đúng 1 kết quả thì tự chọn luôn cho nhanh.
          const q = e.target.value.trim().toLowerCase()
          if (q) {
            const matches = pokedexSpecies.filter((s) => s.name.toLowerCase().includes(q))
            if (matches.length === 1) {
              onChangeSpecies(matches[0])
              const t = getBossTier(matches[0].name)
              const mx = t ? t.maxLevel : 100
              if (level > mx) onChangeLevel(mx)
            }
          }
        }}
        placeholder="🔎 Tìm loài... (VD: ho-oh, chariz, dialga)"
        style={{ marginBottom: 6 }}
      />
      <select value={species?.species ?? ''} onChange={handleSpeciesChange}>
        <option value="">— Chọn loài — ({filtered.length} kết quả)</option>
        {filtered.map((s) => (
          <option key={s.species} value={s.species}>
            {s.name}
            {getBossTier(s.name) ? ` (Boss, Lv≤${getBossTier(s.name).maxLevel})` : ''}
          </option>
        ))}
      </select>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 11.5 }}>
          Level: {level} {tier && <span style={{ color: 'var(--amber)' }}>(tối đa {maxLevel} — Boss)</span>}
        </label>
        <input
          type="range"
          min="1"
          max={maxLevel}
          value={level}
          onChange={(e) => onChangeLevel(Number(e.target.value))}
        />
      </div>
    </div>
  )
}

export default SidePicker
