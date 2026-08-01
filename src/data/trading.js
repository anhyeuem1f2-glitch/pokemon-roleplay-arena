import { createStableId, ensurePokemonIdentity, publicTrainerCode } from './persistentIdentity.js'
import { modeAllowsTrading } from './gameModes.js'
import { evolveOwnedMon, isDirectEvolution, validateEvolutionRequirements } from './pokemonSpecies.js'

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

export function makeTradeOffer(mon, senderTrainerId, recipientTrainerCode, mode, adminOverride = false) {
  if (!modeAllowsTrading(mode, adminOverride)) throw new Error('Trao đổi chỉ hoạt động trong chế độ Thực tế (hoặc phiên Admin).')
  if (!mon?.uid || !senderTrainerId) throw new Error('Thiếu mã cố định của người gửi hoặc Pokémon.')
  if (mon.currentTrainerId && mon.currentTrainerId !== senderTrainerId) throw new Error('Trainer này không phải chủ sở hữu hiện tại của cá thể.')
  const normalizedRecipient = String(recipientTrainerCode ?? '').trim().toUpperCase()
  if (normalizedRecipient && !/^TR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizedRecipient)) {
    throw new Error('Mã người nhận phải có dạng TR-XXXX-XXXX, hoặc để trống cho đề nghị công khai.')
  }
  const payload = {
    version: 1,
    transferId: createStableId('trade'),
    senderTrainerId,
    recipientTrainerCode: normalizedRecipient || null,
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

export function acceptTradePacket(packet, receiverTrainerId, receiverTrainerCode, tradeState, ownedMons, mode, adminOverride = false) {
  if (!modeAllowsTrading(mode, adminOverride)) throw new Error('Trao đổi chỉ hoạt động trong chế độ Thực tế (hoặc phiên Admin).')
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

function speciesKey(value) {
  return String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '')
}

/** Tiến hoá ngay các nhánh trade tiêu chuẩn sau khi quyền sở hữu đã đổi. */
export function evolveReceivedTradePokemon(mon, pokedexSpecies, movesDb = null) {
  if (!mon?.tradeHistory?.length) return { pokemon: mon, evolved: false }
  const source = (pokedexSpecies ?? []).find((entry) =>
    [entry.name, entry.species, entry.baseSpeciesId].some((value) => speciesKey(value) === speciesKey(mon.species ?? mon.name)),
  )
  if (!source) return { pokemon: mon, evolved: false }
  const candidates = (pokedexSpecies ?? []).filter((entry) =>
    /trade/i.test(String(entry.evoType ?? '')) && isDirectEvolution(source, entry),
  )
  for (const target of candidates) {
    const check = validateEvolutionRequirements(mon, source, target, {
      mode: 'realistic', adminMode: false, inventory: [], storyText: '',
    })
    if (check.ok) return { pokemon: evolveOwnedMon(mon, target, movesDb), evolved: true, from: mon.name, to: target.name }
  }
  return { pokemon: mon, evolved: false }
}

export function verifyReceipt(text, offer) {
  let receipt
  try { receipt = JSON.parse(String(text ?? '').trim()) } catch { throw new Error('Biên nhận không phải JSON hợp lệ.') }
  const { checksum: provided, ...payload } = receipt ?? {}
  if (!provided || checksum(JSON.stringify(payload)) !== provided) throw new Error('Biên nhận đã bị sửa.')
  if (payload.version !== 1 || !payload.receiverTrainerId
    || payload.transferId !== offer.transferId || payload.pokemonUid !== offer.pokemon.uid) {
    throw new Error('Biên nhận không khớp đề nghị này.')
  }
  if (offer.recipientTrainerCode && publicTrainerCode(payload.receiverTrainerId) !== offer.recipientTrainerCode) {
    throw new Error('Biên nhận không đến từ trainer được chỉ định trong đề nghị.')
  }
  return receipt
}
