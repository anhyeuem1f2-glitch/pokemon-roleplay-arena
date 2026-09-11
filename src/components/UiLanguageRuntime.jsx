import React, { useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { hasExactUiTranslation, translateUiText, UI_LANGUAGES } from '../i18n/uiLanguage.js'
import {
  getCachedUiAutoTranslation,
  looksLikeVietnameseUi,
  requestUiAutoTranslation,
} from '../services/uiAutoTranslate.js'

const sourceText = new WeakMap()
const lastRenderedText = new WeakMap()
const sourceAttrs = new WeakMap()
const lastRenderedAttrs = new WeakMap()
const ATTRIBUTE_NAMES = ['placeholder', 'title', 'aria-label']
let runtimeLanguage = 'vi'

const NO_TRANSLATE_BASE = [
  '[data-ui-no-translate="true"]',
  '[data-ui-language-control="true"]',
  '[translate="no"]',
  '.story-text',
  '.action-choice__text',
  '.llm-debug__payload',
  '.llm-debug__raw',
  'pre', 'code', 'script', 'style', '[contenteditable="true"]',
]

function skippedText(element) {
  // Nội dung người dùng đang nhập trong textarea tuyệt đối không được dịch.
  return Boolean(element?.closest?.([...NO_TRANSLATE_BASE, 'textarea'].join(',')))
}

function skippedAttributes(element) {
  // Placeholder/title/aria-label CỦA textarea là UI nên vẫn phải dịch.
  return Boolean(element?.closest?.(NO_TRANSLATE_BASE.join(',')))
}

function reapplyWhitespace(source, translated) {
  const lead = String(source ?? '').match(/^\s*/)?.[0] ?? ''
  const tail = String(source ?? '').match(/\s*$/)?.[0] ?? ''
  return `${lead}${String(translated ?? '').trim()}${tail}`
}

function needsGoogle(source, language) {
  // Chinese is fully bundled/offline from đợt 127 so players in mainland China
  // never depend on Google domains. English may still use Google as a fallback.
  return language === 'en' && !hasExactUiTranslation(source, language) && looksLikeVietnameseUi(source)
}

function applyAsyncText(node, source, language) {
  if (!needsGoogle(source, language)) return
  const cached = getCachedUiAutoTranslation(source, language)
  if (cached) {
    const next = reapplyWhitespace(source, cached)
    lastRenderedText.set(node, next)
    if (node.nodeValue !== next) node.nodeValue = next
    return
  }
  requestUiAutoTranslation(source, language).then((translated) => {
    if (!translated || runtimeLanguage !== language || sourceText.get(node) !== source || !node.isConnected) return
    const next = reapplyWhitespace(source, translated)
    lastRenderedText.set(node, next)
    if (node.nodeValue !== next) node.nodeValue = next
  })
}

function translateTextNode(node, language) {
  const parent = node.parentElement
  if (!parent || skippedText(parent)) return
  const current = node.nodeValue ?? ''
  const previousRendered = lastRenderedText.get(node)
  if (!sourceText.has(node) || current !== previousRendered) sourceText.set(node, current)
  const source = sourceText.get(node) ?? current
  const cached = needsGoogle(source, language) ? getCachedUiAutoTranslation(source, language) : null
  const next = cached ? reapplyWhitespace(source, cached) : translateUiText(source, language)
  lastRenderedText.set(node, next)
  if (current !== next) node.nodeValue = next
  if (!cached) applyAsyncText(node, source, language)
}

function applyAsyncAttribute(element, name, source, language) {
  if (!needsGoogle(source, language)) return
  const cached = getCachedUiAutoTranslation(source, language)
  const commit = (translated) => {
    if (!translated || runtimeLanguage !== language || !element.isConnected) return
    const sources = sourceAttrs.get(element)
    if (!sources || sources[name] !== source) return
    const rendered = lastRenderedAttrs.get(element) || {}
    const next = reapplyWhitespace(source, translated)
    rendered[name] = next
    lastRenderedAttrs.set(element, rendered)
    if (element.getAttribute(name) !== next) element.setAttribute(name, next)
  }
  if (cached) commit(cached)
  else requestUiAutoTranslation(source, language).then(commit)
}

function translateAttributes(element, language) {
  if (!(element instanceof Element) || skippedAttributes(element)) return
  let sources = sourceAttrs.get(element)
  let rendered = lastRenderedAttrs.get(element)
  if (!sources) { sources = {}; sourceAttrs.set(element, sources) }
  if (!rendered) { rendered = {}; lastRenderedAttrs.set(element, rendered) }
  for (const name of ATTRIBUTE_NAMES) {
    if (!element.hasAttribute(name)) continue
    const current = element.getAttribute(name) ?? ''
    if (!(name in sources) || current !== rendered[name]) sources[name] = current
    const source = sources[name]
    const cached = needsGoogle(source, language) ? getCachedUiAutoTranslation(source, language) : null
    const next = cached ? reapplyWhitespace(source, cached) : translateUiText(source, language)
    rendered[name] = next
    if (current !== next) element.setAttribute(name, next)
    if (!cached) applyAsyncAttribute(element, name, source, language)
  }
}

function walk(root, language) {
  if (!root) return
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language)
    return
  }
  if (!(root instanceof Element) && root !== document.body) return
  if (root instanceof Element && skippedText(root) && skippedAttributes(root)) return
  if (root instanceof Element) translateAttributes(root, language)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language)
    else translateAttributes(node, language)
    node = walker.nextNode()
  }
}

export default function UiLanguageRuntime() {
  const { uiLanguage } = useGame()

  useEffect(() => {
    runtimeLanguage = uiLanguage
    const info = UI_LANGUAGES.find((entry) => entry.key === uiLanguage) ?? UI_LANGUAGES[0]
    document.documentElement.lang = info.htmlLang
    document.documentElement.dataset.uiLanguage = uiLanguage
    walk(document.body, uiLanguage)

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') translateTextNode(record.target, uiLanguage)
        if (record.type === 'attributes') translateAttributes(record.target, uiLanguage)
        for (const node of record.addedNodes ?? []) walk(node, uiLanguage)
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTE_NAMES,
    })

    // Nếu Google Translate/bridge tạm rate-limit, bản 122 có thể để lại text Việt
    // mãi cho tới lần mutation tiếp theo. Đợt 123 quét lại nhẹ mỗi 15s để các
    // chuỗi visible tự được retry sau cooldown mà không cần F5 hay đổi ngôn ngữ.
    const retryTimer = uiLanguage === 'vi'
      ? null
      : window.setInterval(() => walk(document.body, uiLanguage), 15_000)

    return () => {
      observer.disconnect()
      if (retryTimer) window.clearInterval(retryTimer)
    }
  }, [uiLanguage])

  return null
}
