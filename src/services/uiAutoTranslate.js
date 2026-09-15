// Compatibility shim retained so an overwrite/extract can neutralize older
// runtime versions that used Google Translate. This module performs NO fetch.
import { normalizeUiLanguage, translateUiText } from '../i18n/uiLanguage.js'

export function looksLikeVietnameseUi(value) {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(String(value ?? ''))
}

export function getCachedUiAutoTranslation(source, language) {
  const lang = normalizeUiLanguage(language)
  if (lang === 'vi') return null
  const translated = translateUiText(source, lang)
  return translated !== String(source ?? '') ? translated : null
}

export function requestUiAutoTranslation(source, language) {
  return Promise.resolve(getCachedUiAutoTranslation(source, language))
}
