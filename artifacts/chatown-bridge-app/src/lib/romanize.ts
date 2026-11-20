import type { Lang } from './types'

const BN_MAP: Record<string, string> = {
  '\u0985': 'o', '\u0986': 'a', '\u0987': 'i', '\u0988': 'i', '\u0989': 'u',
  '\u098A': 'u', '\u098B': 'ri', '\u098F': 'e', '\u0990': 'oi', '\u0993': 'o',
  '\u0994': 'ou', '\u0995': 'k', '\u0996': 'kh', '\u0997': 'g', '\u0998': 'gh',
  '\u0999': 'ng', '\u099A': 'ch', '\u099B': 'chh', '\u099C': 'j', '\u099D': 'jh',
  '\u099E': 'n', '\u099F': 't', '\u09A0': 'th', '\u09A1': 'd', '\u09A2': 'dh',
  '\u09A3': 'n', '\u09A4': 't', '\u09A5': 'th', '\u09A6': 'd', '\u09A7': 'dh',
  '\u09A8': 'n', '\u09AA': 'p', '\u09AB': 'ph', '\u09AC': 'b', '\u09AD': 'bh',
  '\u09AE': 'm', '\u09AF': 'y', '\u09B0': 'r', '\u09B2': 'l', '\u09B6': 'sh',
  '\u09B7': 'sh', '\u09B8': 's', '\u09B9': 'h', '\u09DC': 'r', '\u09DD': 'rh',
  '\u09DF': 'y', '\u09CE': 't', '\u0982': 'ng', '\u0983': 'h', '\u0981': 'n',
  '\u09BE': 'a', '\u09BF': 'i', '\u09C0': 'i', '\u09C1': 'u', '\u09C2': 'u',
  '\u09C3': 'ri', '\u09C7': 'e', '\u09C8': 'oi', '\u09CB': 'o', '\u09CC': 'ou',
  '\u09CD': '', '\u0964': '.', ' ': ' ',
}

export function romanizeBn(text: string): string {
  let out = ''
  for (const ch of text) out += BN_MAP[ch] ?? ch
  return out.replace(/\s+/g, ' ').trim()
}

export async function romanizeZh(text: string): Promise<string> {
  try {
    const { pinyin } = await import('pinyin-pro')
    return pinyin(text, { toneType: 'symbol', type: 'array' }).join(' ')
  } catch {
    return text
  }
}

export async function romanize(text: string, lang: Lang): Promise<string> {
  if (!text) return ''
  return lang === 'zh' ? romanizeZh(text) : romanizeBn(text)
}
