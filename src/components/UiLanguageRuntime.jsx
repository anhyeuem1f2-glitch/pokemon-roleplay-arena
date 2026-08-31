import React, { useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { translateUiText, UI_LANGUAGES } from '../i18n/uiLanguage.js'

const sourceText = new WeakMap()
const lastRenderedText = new WeakMap()
const sourceAttrs = new WeakMap()
const lastRenderedAttrs = new WeakMap()
const ATTRIBUTE_NAMES = ['placeholder', 'title', 'aria-label']

function skipped(element) {
  return Boolean(element?.closest?.([
    '[data-ui-no-translate="true"]',
    '.story-text',
    '.action-choice__text',
    '.llm-debug__payload',
    '.llm-debug__raw',
    'textarea', 'pre', 'code', 'script', 'style', '[contenteditable="true"]',
  ].join(',')))
}

function translateTextNode(node, language) {
  const parent = node.parentElement
  if (!parent || skipped(parent)) return
  const current = node.nodeValue ?? ''
  const previousRendered = lastRenderedText.get(node)
  if (!sourceText.has(node) || current !== previousRendered) sourceText.set(node, current)
  const source = sourceText.get(node) ?? current
  const next = translateUiText(source, language)
  lastRenderedText.set(node, next)
  if (current !== next) node.nodeValue = next
}

function translateAttributes(element, language) {
  if (!(element instanceof Element) || skipped(element)) return
  let sources = sourceAttrs.get(element)
  let rendered = lastRenderedAttrs.get(element)
  if (!sources) { sources = {}; sourceAttrs.set(element, sources) }
  if (!rendered) { rendered = {}; lastRenderedAttrs.set(element, rendered) }
  for (const name of ATTRIBUTE_NAMES) {
    if (!element.hasAttribute(name)) continue
    const current = element.getAttribute(name) ?? ''
    if (!(name in sources) || current !== rendered[name]) sources[name] = current
    const next = translateUiText(sources[name], language)
    rendered[name] = next
    if (current !== next) element.setAttribute(name, next)
  }
}

function walk(root, language) {
  if (!root) return
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language)
    return
  }
  if (!(root instanceof Element) && root !== document.body) return
  if (root instanceof Element && skipped(root)) return
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
    const info = UI_LANGUAGES.find((entry) => entry.key === uiLanguage) ?? UI_LANGUAGES[0]
    document.documentElement.lang = info.htmlLang
    walk(document.body, uiLanguage)
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') translateTextNode(record.target, uiLanguage)
        if (record.type === 'attributes') translateAttributes(record.target, uiLanguage)
        for (const node of record.addedNodes ?? []) walk(node, uiLanguage)
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTE_NAMES })
    return () => observer.disconnect()
  }, [uiLanguage])

  return null
}
