import React, { useEffect, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { getNotebook, subscribeNotebook } from '../utils/storyNotebook.js'
import { getGameMode } from '../data/gameModes.js'

const statusLabel = { active: 'Đang làm', completed: 'Hoàn thành', failed: 'Thất bại', paused: 'Tạm dừng' }

export default function WorldProgressModal({ onClose }) {
  const { worldProgress, setWorldProgress, storyTone, trainerCode } = useGame()
  const [tab, setTab] = useState('quests')
  const [notebook, setNotebook] = useState(() => getNotebook())
  useEffect(() => subscribeNotebook(() => setNotebook(getNotebook())), [])
  const tabs = [['quests', 'Nhiệm vụ'], ['badges', 'Huy hiệu'], ['factions', 'Phe phái'], ['law', 'Pháp luật'], ['npcs', 'NPC']]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 96, padding: 16, display: 'grid', placeItems: 'center', background: 'rgba(2,7,11,.82)', backdropFilter: 'blur(8px)' }}>
      <div onClick={(event) => event.stopPropagation()} className="panel" style={{ width: 'min(900px, 97vw)', maxHeight: '92vh', overflow: 'hidden', padding: 0, borderRadius: 16 }}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: 'var(--amber)', fontSize: 10, fontWeight: 800, letterSpacing: '.14em' }}>TIẾN TRÌNH THẾ GIỚI · {trainerCode}</div>
            <div className="page-title" style={{ margin: '3px 0 0' }}>Nhật ký hành trình</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{getGameMode(storyTone).label} · dữ liệu cố định theo save</div>
          </div>
          <button className="btn" onClick={onClose}>✕ Đóng</button>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
          {tabs.map(([key, label]) => <button key={key} className="btn" onClick={() => setTab(key)} style={{ color: tab === key ? 'var(--amber)' : undefined, whiteSpace: 'nowrap' }}>{label}</button>)}
        </div>
        <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(92vh - 145px)' }}>
          {tab === 'quests' && (
            <div style={{ display: 'grid', gap: 9 }}>
              {worldProgress.quests.length === 0 && <Empty text="Chưa có nhiệm vụ. Khi nhận việc trong chính văn, nhật ký sẽ tự ghi mục tiêu, người giao và phần thưởng." />}
              {worldProgress.quests.map((quest) => (
                <Card key={quest.id} title={quest.title} badge={statusLabel[quest.status] ?? quest.status}>
                  {quest.objective && <div>Mục tiêu: {quest.objective}</div>}
                  {quest.giver && <div>Người giao: {quest.giver}</div>}
                  {quest.reward && <div>Phần thưởng dự kiến: {quest.reward}</div>}
                  <select value={quest.status} onChange={(event) => setWorldProgress((cur) => ({ ...cur, quests: cur.quests.map((item) => item.id === quest.id ? { ...item, status: event.target.value } : item) }))} style={{ marginTop: 8 }}>
                    {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Card>
              ))}
            </div>
          )}
          {tab === 'badges' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--text-mid)', fontSize: 12 }}>
                <input type="checkbox" checked={worldProgress.badgeTracking} onChange={(event) => setWorldProgress((cur) => ({ ...cur, badgeTracking: event.target.checked }))} />
                Theo dõi huy hiệu trong hành trình sandbox (có thể tắt và bỏ qua hoàn toàn)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 9 }}>
                {worldProgress.badges.length === 0 && <Empty text="Chưa lưu huy hiệu nào." />}
                {worldProgress.badges.map((badge) => <Card key={badge.id} title={`🏅 ${badge.name}`} badge={badge.region || 'Không rõ vùng'}>{badge.gym && <div>{badge.gym}</div>}{badge.leader && <div>Gym Leader: {badge.leader}</div>}</Card>)}
              </div>
            </div>
          )}
          {tab === 'factions' && <div style={{ display: 'grid', gap: 9 }}>{worldProgress.factions.length === 0 ? <Empty text="Chưa có phe phái nào hình thành danh tiếng đáng kể." /> : worldProgress.factions.map((faction) => <Card key={faction.id} title={faction.name} badge={`${faction.reputation > 0 ? '+' : ''}${faction.reputation}`}><meter min="-100" max="100" value={faction.reputation} style={{ width: '100%' }} />{faction.note && <div>{faction.note}</div>}</Card>)}</div>}
          {tab === 'law' && (
            <Card title={`Mức truy nã ${worldProgress.wanted.level}/5`} badge={`${worldProgress.wanted.bounty || 0} tiền thưởng`}>
              <div>Vùng áp dụng: {worldProgress.wanted.regions.join(', ') || 'Không có'}</div>
              <div style={{ marginTop: 8, color: 'var(--text-dim)' }}>{worldProgress.wanted.level ? 'Cảnh sát, dân cư và phe phái sẽ phản ứng theo mức này; chế độ Thực tế có hậu quả nghiêm nhất.' : 'Hồ sơ pháp lý sạch.'}</div>
              {worldProgress.wanted.history.slice().reverse().map((event, index) => <div key={`${event.turn}-${index}`} style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--line)' }}>{event.delta > 0 ? '▲' : '▼'} {event.reason} {event.region && `· ${event.region}`}</div>)}
            </Card>
          )}
          {tab === 'npcs' && <div style={{ display: 'grid', gap: 9 }}>{notebook.npcs.length === 0 ? <Empty text="Chưa gặp NPC có tên." /> : notebook.npcs.map((npc) => <Card key={npc.id || npc.name} title={npc.name} badge={npc.id}><div>Đã gặp {npc.encounters || 0} lần · đấu {npc.battles || 0} trận</div>{npc.team?.length > 0 && <div style={{ marginTop: 5 }}>Đội cố định: {npc.team.map((mon) => `${mon.species} Lv${mon.level}`).join(', ')}</div>}</Card>)}</div>}
        </div>
      </div>
    </div>
  )
}

function Empty({ text }) { return <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: 14, color: 'var(--text-dim)', fontSize: 12 }}>{text}</div> }
function Card({ title, badge, children }) { return <div style={{ border: '1px solid var(--line)', borderRadius: 11, padding: 12, background: 'var(--bg-deep)', color: 'var(--text-mid)', fontSize: 11.5, lineHeight: 1.65 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}><b style={{ color: 'var(--text-hi)', fontSize: 13 }}>{title}</b>{badge && <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{badge}</span>}</div>{children}</div> }
