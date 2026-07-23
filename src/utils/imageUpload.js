// ============ TẢI ẢNH ĐẠI DIỆN (đợt 54) ============
// Ảnh người chơi chọn từ máy có thể nặng vài MB — KHÔNG được nhét thẳng vào
// localStorage (quota ~5MB và còn phải chia cho lịch sử truyện đã persist từ
// đợt 46). Vì vậy: vẽ lại qua canvas, cắt vuông giữa ảnh, thu về tối đa
// 320px, xuất JPEG chất lượng 0.82 → thường chỉ 20-45KB kể cả base64.

const MAX_SIZE = 320
const QUALITY = 0.82
// Chặn file quá lớn trước khi đọc (ảnh chụp màn hình 4K, ảnh RAW...).
const MAX_INPUT_BYTES = 12 * 1024 * 1024

export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/**
 * Đọc File ảnh → data URL JPEG vuông đã nén.
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Chưa chọn file nào.'))
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File này không phải ảnh. Hãy chọn PNG / JPG / WEBP.'))
    }
    if (file.size > MAX_INPUT_BYTES) {
      return reject(new Error('Ảnh quá lớn (trên 12MB). Hãy chọn ảnh nhỏ hơn.'))
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Ảnh hỏng hoặc định dạng không đọc được.'))
      img.onload = () => {
        try {
          // Cắt vuông ở GIỮA ảnh (khung avatar là hình vuông).
          const side = Math.min(img.width, img.height)
          const sx = (img.width - side) / 2
          const sy = (img.height - side) / 2
          const out = Math.min(side, MAX_SIZE)

          const canvas = document.createElement('canvas')
          canvas.width = out
          canvas.height = out
          const ctx = canvas.getContext('2d')
          // JPEG không có kênh alpha: nền trong suốt sẽ thành ĐEN nếu không
          // tô trước — tô màu nền tối của app cho khớp giao diện.
          ctx.fillStyle = '#0f1115'
          ctx.fillRect(0, 0, out, out)
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)

          const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
          if (!dataUrl || dataUrl.length < 100) throw new Error('Nén ảnh thất bại.')
          resolve(dataUrl)
        } catch (err) {
          reject(new Error(`Không xử lý được ảnh: ${err.message}`))
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/** Cỡ xấp xỉ (KB) của một data URL — dùng để cảnh báo khi lưu. */
export function dataUrlSizeKb(dataUrl) {
  if (!dataUrl) return 0
  const b64 = dataUrl.split(',')[1] ?? ''
  return Math.round((b64.length * 3) / 4 / 1024)
}
