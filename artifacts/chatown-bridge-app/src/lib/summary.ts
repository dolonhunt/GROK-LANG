import type { Message, Lang } from './types'
import { translate } from './api'

/** Local extractive summary + optional translated blurb. No paid LLM required. */
export async function summarizeMeeting(
  messages: Message[],
  outLang: Lang,
): Promise<string> {
  if (messages.length === 0) return outLang === 'bn' ? 'কোনো বার্তা নেই।' : '没有消息。'
  const speakers = new Set(messages.map((m) => m.speakerName || m.speakerId))
  const bnCount = messages.filter((m) => m.srcLang === 'bn').length
  const zhCount = messages.filter((m) => m.srcLang === 'zh').length
  const last = messages.slice(-5)
  const bullets = last.map((m) => {
    const name = m.speakerName || m.speakerId
    const text =
      outLang === 'bn'
        ? m.translations.bn || (m.srcLang === 'bn' ? m.srcText : m.srcText)
        : m.translations.zh || (m.srcLang === 'zh' ? m.srcText : m.srcText)
    return `• ${name}: ${text}`
  })

  const header =
    outLang === 'bn'
      ? `সারাংশ: ${messages.length} বার্তা, ${speakers.size} অংশগ্রহণকারী (বাংলা ${bnCount}, চীনা ${zhCount}).`
      : `摘要：${messages.length} 条消息，${speakers.size} 位参与者（孟加拉语 ${bnCount}，中文 ${zhCount}）。`

  // Translate header if needed via API for mixed quality — keep bilingual static for reliability
  let extra = ''
  try {
    if (messages.length >= 1) {
      const sample = messages.map((m) => m.srcText).join(' / ').slice(0, 200)
      const from: Lang = messages[0]!.srcLang
      const to: Lang = from === 'bn' ? 'zh' : 'bn'
      if (outLang === to) {
        const { translation } = await translate(`Key points: ${sample}`, from, to)
        extra = `\n${translation}`
      }
    }
  } catch {
    /* ignore */
  }

  return `${header}\n\n${bullets.join('\n')}${extra}`
}
