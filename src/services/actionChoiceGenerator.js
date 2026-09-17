import { chatCompletion } from './aiClient.js'
import { actionChoicesMatchLanguage, buildActionChoicesInstruction, extractActionChoices } from '../utils/actionChoices.js'

function buildSystem(language = 'vi') {
  return `You generate player action suggestions for a Pokémon roleplay web game.
${buildActionChoicesInstruction(language)}
IMPORTANT: The selected UI language is authoritative for the <actions> block. Even if the story/preset/context is written in another language, DO NOT copy that language into the suggestions. Output the four suggestion texts in the selected UI language only.`
}

function buildPrompt({ recentContext = '', storyText = '', userText = '', playerName = '', retry = false }) {
  return [
    playerName ? `PLAYER CHARACTER: ${playerName}` : '',
    recentContext ? `RECENT CONTEXT:\n${recentContext.slice(-5000)}` : '',
    userText ? `LAST PLAYER INPUT:\n${userText.slice(0, 1200)}` : '',
    `LATEST STORY TEXT:\n${storyText.slice(-4000)}`,
    retry ? 'The previous attempt did not produce four valid choices in the selected UI language. Retry from scratch and obey CHOICE OUTPUT LANGUAGE exactly.' : '',
    'Generate exactly 4 next-player action choices now:',
  ].filter(Boolean).join('\n\n')
}

async function generateOnce(cfg, args, retry = false) {
  const reply = await chatCompletion(cfg, [
    { role: 'system', content: buildSystem(args.language || 'vi') },
    { role: 'user', content: buildPrompt({ ...args, retry }) },
  ], { temperature: retry ? 0.55 : 0.75, maxTokens: 550, debugLabel: retry ? 'Action Choices · retry' : 'Action Choices', debugRole: 'action-choice' })
  const language = args.language || 'vi'
  const choices = extractActionChoices(reply, language)
  return actionChoicesMatchLanguage(choices, language) ? choices : []
}

export async function generateActionChoices(cfg, args) {
  if (!args?.storyText?.trim()) return []
  const first = await generateOnce(cfg, args, false)
  if (first.length === 4) return first

  // Fail closed ở parser có thể khiến model/preset cũ trả 0 lựa chọn. Retry
  // đúng một lần bằng prompt chặt hơn thay vì đưa scaffold rác lên giao diện.
  return generateOnce(cfg, args, true)
}
