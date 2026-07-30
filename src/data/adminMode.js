// Cổng quản trị chỉ tồn tại trong phiên trình duyệt. Không có nút công khai,
// query URL hay mục cài đặt nào có thể mở nó.
export const ADMIN_SHORTCUT_LABEL = 'Ctrl + Alt + Shift + T'

export function isAdminShortcut(event) {
  return Boolean(
    event
    && event.ctrlKey
    && event.altKey
    && event.shiftKey
    && String(event.key ?? '').toLowerCase() === 't',
  )
}

/** So sánh mã theo từng ký tự để không vô tình chấp nhận dạng số/chuỗi rút gọn. */
export function verifyAdminCode(value) {
  const expected = ['07', '09', '07'].join('')
  const actual = String(value ?? '')
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

