import { normalizeUiLanguage } from './uiLanguage.js'

export const STORY_LANGUAGES = Object.freeze({
  vi: Object.freeze({ key: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt' }),
  en: Object.freeze({ key: 'en', label: 'English', nativeLabel: 'English' }),
  zh: Object.freeze({ key: 'zh', label: 'Simplified Chinese', nativeLabel: '简体中文' }),
})

function presetText(mainPreset) {
  if (!mainPreset) return ''
  try {
    const chunks = []
    const walk = (value, depth = 0) => {
      if (depth > 8 || value == null) return
      if (typeof value === 'string') {
        chunks.push(value)
        return
      }
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1)
        return
      }
      if (typeof value === 'object') {
        // Only inspect prompt-like fields. Avoid treating a translated preset
        // title/description as an instruction that changes story language.
        for (const [key, child] of Object.entries(value)) {
          if (/^(?:content|prompt|system|text|value|message|messages|blocks|prompt_order|prompts)$/i.test(key)) {
            walk(child, depth + 1)
          } else if (typeof child === 'object' && child !== null) {
            walk(child, depth + 1)
          }
        }
      }
    }
    walk(mainPreset)
    return chunks.join('\n')
  } catch {
    return ''
  }
}

const PRESET_LANGUAGE_RULES = Object.freeze([
  {
    key: 'zh',
    patterns: [
      /(?:respond|reply|write|output|answer|narrat\w*)\s+(?:only\s+|entirely\s+|exclusively\s+|in\s+)*(?:simplified\s+chinese|chinese)\b/i,
      /(?:output|response|reply|language)\s*[:=]\s*(?:simplified\s+chinese|chinese)\b/i,
      /(?:请|必须|务必|一律|仅|只|使用|用|输出|回复|回答|撰写|叙述)[^\n。；;]{0,28}(?:简体中文|中文)/u,
      /(?:简体中文|中文)[^\n。；;]{0,20}(?:输出|回复|回答|撰写|叙述)/u,
    ],
  },
  {
    key: 'en',
    patterns: [
      /(?:respond|reply|write|output|answer|narrat\w*)\s+(?:only\s+|entirely\s+|exclusively\s+|in\s+)*english\b/i,
      /(?:output|response|reply|language)\s*[:=]\s*english\b/i,
      /(?:使用|用|输出|回复|回答|撰写|叙述)[^\n。；;]{0,24}(?:英语|英文)/u,
    ],
  },
  {
    key: 'vi',
    patterns: [
      /(?:respond|reply|write|output|answer|narrat\w*)\s+(?:only\s+|entirely\s+|exclusively\s+|in\s+)*(?:vietnamese|viet\s*namese)\b/i,
      /(?:output|response|reply|language)\s*[:=]\s*(?:vietnamese|viet\s*namese)\b/i,
      /(?:trả\s*lời|viết|đầu\s*ra|ngôn\s*ngữ)[^\n.!?]{0,28}(?:tiếng\s*việt|vietnamese)/iu,
    ],
  },
])

/**
 * Detect an explicit output-language instruction in a SillyTavern preset.
 * This intentionally detects only the three languages supported by the app UI.
 * If no explicit instruction is found, the UI language becomes the story default.
 */
export function detectStoryLanguageInstruction(text) {
  const source = String(text ?? '')
  if (!source.trim()) return null
  for (const rule of PRESET_LANGUAGE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(source))) return rule.key
  }
  return null
}

export function detectPresetStoryLanguage(mainPreset) {
  return detectStoryLanguageInstruction(presetText(mainPreset))
}

export function resolveStoryLanguage(uiLanguage = 'vi', mainPreset = null, stylePreset = '') {
  return detectPresetStoryLanguage(mainPreset)
    ?? detectStoryLanguageInstruction(stylePreset)
    ?? normalizeUiLanguage(uiLanguage)
}

export function storyLanguageInfo(language = 'vi') {
  return STORY_LANGUAGES[language] ?? STORY_LANGUAGES.vi
}

/**
 * System instruction used by the main story pipeline. It is deliberately
 * written in English so its meaning is stable no matter which UI language is
 * currently selected.
 */
export function buildStoryLanguageInstruction(language = 'vi') {
  const lang = storyLanguageInfo(language)
  return `OUTPUT LANGUAGE: ${lang.label} (${lang.nativeLabel}). Write ALL player-visible narrative, dialogue and generated action-choice text in ${lang.label}. Internal control tags such as [[BATTLE]] and XML-like <actions> wrappers must keep their exact machine-readable syntax. Do not translate the user's proper names, Pokémon names or custom item names unless the supplied canon/preset already does so.`
}

/**
 * For post-processing/auxiliary calls that already receive prose, following
 * the source text is safer than blindly following UI: a preset is allowed to
 * explicitly choose another output language.
 */
export function buildSameLanguageInstruction(fallbackLanguage = 'vi') {
  const lang = storyLanguageInfo(fallbackLanguage)
  return `LANGUAGE: Preserve and use the SAME language as the supplied player-visible story text. Never translate it to another language. If the supplied story text is empty or genuinely ambiguous, use ${lang.label} (${lang.nativeLabel}).`
}
