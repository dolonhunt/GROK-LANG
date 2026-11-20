/**
 * Local multi-device rooms via HTTP API (functions local-server).
 * Used when Firebase is not configured.
 */
import type { Lang, Message, Participant, Room } from './types'

const API = import.meta.env.VITE_API_BASE || '/api'

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function localCreateRoom(host: {
  name: string
  lang: Lang
  deviceId: string
  uid: string
}): Promise<{ room: Room; participant: Participant }> {
  return json('/rooms', { method: 'POST', body: JSON.stringify(host) })
}

export async function localJoinRoom(
  code: string,
  me: { name: string; lang: Lang; deviceId: string; uid: string; speakerLabel?: string },
): Promise<{ room: Room; participant: Participant }> {
  return json(`/rooms/${encodeURIComponent(code.toUpperCase())}/join`, {
    method: 'POST',
    body: JSON.stringify(me),
  })
}

export async function localGetRoom(code: string): Promise<{
  room: Room
  participants: Participant[]
  messages: Message[]
}> {
  return json(`/rooms/${encodeURIComponent(code.toUpperCase())}`)
}

export async function localPostMessage(
  code: string,
  msg: Message,
): Promise<Message> {
  return json(`/rooms/${encodeURIComponent(code.toUpperCase())}/messages`, {
    method: 'POST',
    body: JSON.stringify(msg),
  })
}

export async function localSetSpeaking(
  code: string,
  speaking: { participantId: string; name: string } | null,
): Promise<void> {
  await json(`/rooms/${encodeURIComponent(code.toUpperCase())}/speaking`, {
    method: 'POST',
    body: JSON.stringify({ speaking }),
  })
}

export function localPollRoom(
  code: string,
  onUpdate: (data: {
    room: Room
    participants: Participant[]
    messages: Message[]
  }) => void,
  intervalMs = 800,
): () => void {
  let stopped = false
  let timer: number | undefined
  const tick = async () => {
    if (stopped) return
    try {
      const data = await localGetRoom(code)
      if (!stopped) onUpdate(data)
    } catch {
      /* ignore transient */
    }
    if (!stopped) timer = window.setTimeout(tick, intervalMs)
  }
  void tick()
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}
