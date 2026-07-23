import React, { useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { buildMonSmart } from '../data/pokemonSpecies.js'
import { detectMentionedArea, getArea, getRegion } from '../data/regions.js'
import { BODY_PARTS, bodyPartLabel } from './BodyFigure.jsx'
import BodyFigure from './BodyFigure.jsx'
import PlayerHUD from './PlayerHUD.jsx'
import RegionMap from './RegionMap.jsx'
import SidePicker from './SidePicker.jsx'
import ShopModal from './ShopModal.jsx'

// ============ TAB TEST GIAO DIỆN (Dev Mode) ============
// HUD dọc trái chỉ xuất hiện trong màn chơi thật — tab này dựng sẵn 1 bản
// PREVIEW SỐNG của chính HUD đó (cùng state trong GameContext) cạnh bảng
// điều khiển chỉnh-mọi-thứ-thật-nhanh: hồ sơ, sinh lực từng bộ phận, đội
// hình (bấm ô Pokémon trong HUD để xem modal chi tiết), quan hệ NPC, và khu
// test dò vị trí bản đồ (dán chính văn → xem app nhận ra đúng vùng/khu nào).
// Mọi chỉnh sửa ghi thẳng vào context nên vào màn chơi thật sẽ thấy y hệt.

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-dim)', width: 78, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}

export default function UiTester() {
  const {
    playerName,
    setPlayerName,
    playerProfile,
    setPlayerProfile,
    bodyStatus,
    setBodyStatus,
    party,
    setParty,
    relationships,
    setRelationships,
    playerLocation,
    setPlayerLocation,
    pokedexSpecies,
    movesDb,
    inventory,
    setInventory,
  } = useGame()

  // --- đội hình ---
  const [pickSpecies, setPickSpecies] = useState(null)
  const [pickLevel, setPickLevel] = useState(20)

  // --- quan hệ ---
  const [npcName, setNpcName] = useState('')
  const [npcAffinity, setNpcAffinity] = useState(0)
  const [npcNote, setNpcNote] = useState('')

  // --- test dò vị trí ---
  const [locText, setLocText] = useState('')
  const [locResult, setLocResult] = useState(null) // {found, moved, area, region} | null

  // --- test shop ---
  const [shopOpen, setShopOpen] = useState(false)
  const [lastShopResult, setLastShopResult] = useState(null)

  function addToParty() {
    if (!pickSpecies || party.length >= 6) return
    setParty([...party, buildMonSmart(pickSpecies, pickLevel, movesDb)])
  }

  function addNpc() {
    const name = npcName.trim()
    if (!name) return
    setRelationships([
      ...relationships,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, affinity: npcAffinity, note: npcNote.trim() },
    ])
    setNpcName('')
    setNpcNote('')
    setNpcAffinity(0)
  }

  function runLocTest() {
    const detected = detectMentionedArea(locText, playerLocation)
    if (detected) {
      setPlayerLocation(detected)
      const area = getArea(detected.regionKey, detected.areaKey)
      const region = getRegion(detected.regionKey)
      setLocResult({ found: true, area, region })
    } else {
      setLocResult({ found: false })
    }
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Preview HUD sống — đúng component dùng trong màn chơi */}
      <div style={{ flexShrink: 0, border: '1px dashed var(--amber)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ fontSize: 10, color: 'var(--amber)', textAlign: 'center', padding: '4px 0', borderBottom: '1px dashed var(--amber)' }}>
          PREVIEW HUD (bấm ô Pokémon để xem chi tiết)
        </div>
        <PlayerHUD />
      </div>

      {/* Bảng điều khiển */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Hồ sơ người chơi</h3>
          <Row label="Tên">
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Tên nhà huấn luyện" />
          </Row>
          <Row label="Tuổi">
            <input
              type="number"
              value={playerProfile.age}
              onChange={(e) => setPlayerProfile({ ...playerProfile, age: Number(e.target.value) || 0 })}
              style={{ width: 90 }}
            />
          </Row>
          <Row label="Tiền (₽)">
            <input
              type="number"
              value={playerProfile.money}
              onChange={(e) => setPlayerProfile({ ...playerProfile, money: Number(e.target.value) || 0 })}
              style={{ width: 140 }}
            />
          </Row>
          <Row label="Avatar URL">
            <input
              value={playerProfile.avatarUrl}
              onChange={(e) => setPlayerProfile({ ...playerProfile, avatarUrl: e.target.value })}
              placeholder="https://... (ảnh vuông đẹp nhất)"
              style={{ flex: 1 }}
            />
          </Row>
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Sinh lực theo bộ phận (chế độ chân thực)</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px' }}>
            Kéo slider hoặc BẤM TRỰC TIẾP vào bộ phận trên hình để cộng nhanh +25 (quay vòng về 0).
            Xám lành lặn → vàng nhẹ → cam vừa → đỏ nặng → đỏ sậm nguy kịch → đen là mất hẳn.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <BodyFigure
              bodyStatus={bodyStatus}
              size={110}
              onPartClick={(k) => setBodyStatus({ ...bodyStatus, [k]: bodyStatus[k] >= 100 ? 0 : Math.min(100, bodyStatus[k] + 25) })}
            />
            <div style={{ flex: 1 }}>
              {BODY_PARTS.map((p) => (
                <div key={p.key} style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 11 }}>
                    {p.label}: {bodyStatus[p.key]}/100 ({bodyPartLabel(bodyStatus[p.key])})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bodyStatus[p.key]}
                    onChange={(e) => setBodyStatus({ ...bodyStatus, [p.key]: Number(e.target.value) })}
                  />
                </div>
              ))}
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button
                  className="btn"
                  onClick={() => setBodyStatus({ head: 0, torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 })}
                >
                  Hồi phục hết
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    setBodyStatus(
                      Object.fromEntries(BODY_PARTS.map((p) => [p.key, Math.floor(Math.random() * 101)])),
                    )
                  }
                >
                  Random thương tích
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Đội hình ({party.length}/6)</h3>
          <SidePicker
            label="Thêm Pokémon vào đội"
            species={pickSpecies}
            onChangeSpecies={setPickSpecies}
            level={pickLevel}
            onChangeLevel={setPickLevel}
            pokedexSpecies={pokedexSpecies}
          />
          <div className="btn-row">
            <button className="btn btn--primary" onClick={addToParty} disabled={!pickSpecies || party.length >= 6}>
              Thêm vào đội
            </button>
            <button className="btn" onClick={() => setParty([])} disabled={party.length === 0}>
              Xoá cả đội
            </button>
          </div>
          {party.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {party.map((mon, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span>
                    {i + 1}. {mon.name} Lv{mon.level}
                  </span>
                  <button className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setParty(party.filter((_, j) => j !== i))}>
                    Bỏ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Quan hệ NPC (hảo cảm -100..100)</h3>
          <Row label="Tên NPC">
            <input value={npcName} onChange={(e) => setNpcName(e.target.value)} placeholder="VD: Misty" />
          </Row>
          <Row label={`Hảo cảm: ${npcAffinity}`}>
            <input type="range" min="-100" max="100" value={npcAffinity} onChange={(e) => setNpcAffinity(Number(e.target.value))} style={{ flex: 1 }} />
          </Row>
          <Row label="Ghi chú">
            <input value={npcNote} onChange={(e) => setNpcNote(e.target.value)} placeholder="VD: đội trưởng gym Cerulean" style={{ flex: 1 }} />
          </Row>
          <div className="btn-row">
            <button className="btn btn--primary" onClick={addNpc} disabled={!npcName.trim()}>
              Thêm NPC
            </button>
            <button className="btn" onClick={() => setRelationships([])} disabled={relationships.length === 0}>
              Xoá hết
            </button>
          </div>
          {relationships.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {relationships.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span>
                    {r.name} ({r.affinity > 0 ? '+' : ''}
                    {r.affinity})
                  </span>
                  <button
                    className="btn"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setRelationships(relationships.filter((x) => x.id !== r.id))}
                  >
                    Bỏ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Test Shop (giỏ hàng)</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px' }}>
            Mở đúng giao diện giỏ hàng dùng trong truyện (trong truyện thật, AI chèn tag
            [[SHOP Tên]] khi nhân vật bước vào cửa hàng → hiện nút 🛒). Mua ở đây TRỪ TIỀN
            THẬT + cộng túi đồ thật để test end-to-end.
          </p>
          <div className="btn-row">
            <button className="btn btn--primary" onClick={() => setShopOpen(true)}>
              Mở shop test (ví: ₽{Number(playerProfile.money).toLocaleString('vi-VN')})
            </button>
            <button className="btn" onClick={() => setInventory([])} disabled={inventory.length === 0}>
              Xoá túi đồ
            </button>
          </div>
          {lastShopResult && (
            <div className="status-pill status-pill--ok" style={{ display: 'block', width: 'fit-content', marginTop: 10 }}>
              {lastShopResult}
            </div>
          )}
          {inventory.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12 }}>
              Túi đồ: {inventory.map((it) => `${it.name} x${it.qty}`).join(', ')}
            </div>
          )}
          {shopOpen && (
            <ShopModal
              shopName="PokéMart (Dev Test)"
              money={Number(playerProfile.money)}
              onClose={() => setShopOpen(false)}
              onFinish={(bought, total) => {
                setShopOpen(false)
                if (bought.length === 0) {
                  setLastShopResult('Rời shop không mua gì.')
                  return
                }
                setPlayerProfile({ ...playerProfile, money: Math.max(0, Number(playerProfile.money) - total) })
                let inv = [...inventory]
                for (const b of bought) {
                  const i = inv.findIndex((x) => x.id === b.id)
                  if (i >= 0) inv[i] = { ...inv[i], qty: inv[i].qty + b.qty }
                  else inv.push({ id: b.id, name: b.name, qty: b.qty })
                }
                setInventory(inv)
                setLastShopResult(`Đã mua ${bought.map((b) => `${b.name} x${b.qty}`).join(', ')} — tổng ₽${total.toLocaleString('vi-VN')}.`)
              }}
            />
          )}
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Test dò vị trí bản đồ</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px' }}>
            Dán 1 đoạn chính văn bất kỳ → bấm "Dò vị trí" để xem app nhận ra ĐÚNG vùng/khu nào
            (kết quả áp luôn vào vị trí thật + HUD). Bên dưới là bản đồ đầy đủ để đối chiếu/chỉnh tay.
          </p>
          <textarea
            value={locText}
            onChange={(e) => setLocText(e.target.value)}
            placeholder='VD: "Cả nhóm băng qua Rock Tunnel, ánh đèn pin quét lên những vách đá ẩm ướt..."'
            style={{ width: '100%', minHeight: 60, marginBottom: 8 }}
          />
          <button className="btn btn--primary" onClick={runLocTest} disabled={!locText.trim()}>
            Dò vị trí
          </button>
          {locResult && (
            <div
              className={`status-pill ${locResult.found ? 'status-pill--ok' : 'status-pill--error'}`}
              style={{ display: 'block', width: 'fit-content', marginTop: 10 }}
            >
              {locResult.found
                ? `Nhận ra: ${locResult.area.name} — vùng ${locResult.region.name} (Gen ${locResult.region.gen}), wild Lv${locResult.area.level[0]}-${locResult.area.level[1]}`
                : 'Không nhận ra địa danh nào trong đoạn này (hoặc vẫn đang đứng đúng khu hiện tại).'}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <RegionMap location={playerLocation} onSetLocation={setPlayerLocation} />
          </div>
        </div>
      </div>
    </div>
  )
}
