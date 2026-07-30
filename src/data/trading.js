import { createStableId, ensurePokemonIdentity } from './persistentIdentity.js'
import { modeAllowsTrading } from './gameModes.js'

export const DEFAULT_TRADE_STATE = { escrow: [], claimedTransfers: [], receipts: [] }

export function normalizeTradeState(value) {
  const raw = value ?? {}
  return {
    escrow: Array.isArray(raw.escrow) ? raw.escrow : [],
    claimedTransfers: Array.isArray(raw.claimedTransfers) ? raw.claimedTransfers : [],
    receipts: Array.isArray(raw.receipts) ? raw.receipts : [],
  }
}

function checksum(text) {
  let value = 0
  for (const char of String(text)) value = (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0
  return value.toString(36).toUpperCase()
}

export function makeTradeOffer(mon, senderTrainerId, recipientTrainerCode, mode) {
  if (!modeAllowsTrading(mode)) throw new Error('Trao đổi chỉ hoạt động trong chế độ Thực tế.')
  if (!mon?.uid || !senderTrainerId) throw new Error('Thiếu mã cố định của người gửi hoặc Pokémon.')
  if (mon.currentTrainerId && mon.currentTrainerId !== senderTrainerId) throw new Error('Trainer này không phải chủ sở hữu hiện tại của cá thể.')
  const payload = {
    version: 1,
    transferId: createStableId('trade'),
    senderTrainerId,
    recipientTrainerCode: String(recipientTrainerCode ?? '').trim().toUpperCase() || null,
    pokemon: ensurePokemonIdentity(mon, senderTrainerId),
    createdAt: new Date().toISOString(),
  }
  return { ...payload, checksum: checksum(JSON.stringify(payload)) }
}

export function encodeTradePacket(packet) {
  return JSON.stringify(packet)
}

export function decodeTradePacket(text) {
  let packet
  try { packet = JSON.parse(String(text ?? '').trim()) } catch { throw new Error('Mã trao đổi không phải JSON hợp lệ.') }
  const { checksum: provided, ...payload } = packet ?? {}
  if (!provided || checksum(JSON.stringify(payload)) !== provided) throw new Error('Mã trao đổi bị thiếu hoặc đã bị sửa.')
  if (payload.version !== 1 || !payload.transferId || !payload.senderTrainerId || !payload.pokemon?.uid) throw new Error('Gói trao đổi thiếu dữ liệu bắt buộc.')
  return packet
}

export function acceptTradePacket(packet, receiverTrainerId, receiverTrainerCode, tradeState, ownedMons, mode) {
  if (!modeAllowsTrading(mode)) throw new Error('Trao đổi chỉ hoạt động trong chế độ Thực tế.')
  const state = normalizeTradeState(tradeState)
  if (packet.senderTrainerId === receiverTrainerId) throw new Error('Không thể nhận gói do chính mã trainer này tạo.')
  if (packet.pokemon.currentTrainerId && packet.pokemon.currentTrainerId !== packet.senderTrainerId) throw new Error('Gói không chứng minh người gửi là chủ sở hữu hiện tại.')
  if (packet.recipientTrainerCode && packet.recipientTrainerCode !== String(receiverTrainerCode ?? '').toUpperCase()) throw new Error('Gói này được khoá cho một trainer khác.')
  if (state.claimedTransfers.includes(packet.transferId)) throw new Error('Gói trao đổi này đã được nhận trên save hiện tại.')
  if ((ownedMons ?? []).some((mon) => mon?.uid === packet.pokemon.uid)) throw new Error('Cá thể này đã tồn tại trên save hiện tại.')
  const received = ensurePokemonIdentity({
    ...packet.pokemon,
    currentTrainerId: receiverTrainerId,
    tradeHistory: [...(packet.pokemon.tradeHistory ?? []), {
      transferId: packet.transferId,
      from: packet.senderTrainerId,
      to: receiverTrainerId,
      at: new Date().toISOString(),
    }],
  }, receiverTrainerId)
  const receiptPayload = { version: 1, transferId: packet.transferId, receiverTrainerId, pokemonUid: received.uid }
  const receipt = { ...receiptPayload, checksum: checksum(JSON.stringify(receiptPayload)) }
  return {
    pokemon: received,
    receipt,
    tradeState: { ...state, claimedTransfers: [...state.claimedTransfers, packet.transferId], receipts: [...state.receipts, receipt] },
  }
}

export function verifyReceipt(text, offer) {
  let receipt
  try { receipt = JSON.parse(String(text ?? '').trim()) } catch { throw new Error('Biên nhận không phải JSON hợp lệ.') }
  const { checksum: provided, ...payload } = receipt ?? {}
  if (!provided || checksum(JSON.stringify(payload)) !== provided) throw new Error('Biên nhận đã bị sửa.')
  if (payload.transferId !== offer.transferId || payload.pokemonUid !== offer.pokemon.uid) throw new Error('Biên nhận không khớp đề nghị này.')
  return receipt
}
