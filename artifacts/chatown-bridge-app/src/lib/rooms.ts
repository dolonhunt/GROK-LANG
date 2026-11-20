import { isFirebaseConfigured } from './firebase'
import * as local from './rooms-local'
import type { Lang, Message, Participant, Room } from './types'
import { getDeviceId } from './device'

export function roomsBackend(): 'firebase' | 'local' {
  return isFirebaseConfigured() ? 'firebase' : 'local'
}

async function fb() {
  return import('./rooms-firebase')
}

export async function createRoom(input: {
  name: string
  lang: Lang
}): Promise<{ room: Room; participant: Participant; uid: string }> {
  const deviceId = getDeviceId()
  if (roomsBackend() === 'firebase') {
    return (await fb()).fbCreateRoom({ ...input, deviceId })
  }
  const uid = `local-${deviceId.slice(0, 8)}`
  const res = await local.localCreateRoom({ ...input, deviceId, uid })
  return { ...res, uid }
}

export async function joinRoom(
  code: string,
  input: { name: string; lang: Lang; speakerLabel?: string },
): Promise<{ room: Room; participant: Participant; uid: string }> {
  const deviceId = getDeviceId()
  if (roomsBackend() === 'firebase') {
    return (await fb()).fbJoinRoom(code, { ...input, deviceId })
  }
  const uid = `local-${deviceId.slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`
  const res = await local.localJoinRoom(code, { ...input, deviceId, uid })
  return { ...res, uid }
}

export async function postRoomMessage(code: string, msg: Message): Promise<void> {
  if (roomsBackend() === 'firebase') {
    await (await fb()).fbPostMessage(code, msg)
    return
  }
  await local.localPostMessage(code, msg)
}

export async function setSpeaking(
  code: string,
  speaking: { participantId: string; name: string } | null,
): Promise<void> {
  if (roomsBackend() === 'firebase') {
    await (await fb()).fbSetSpeaking(
      code,
      speaking ? { ...speaking, until: Date.now() + 15_000 } : null,
    )
    return
  }
  await local.localSetSpeaking(code, speaking)
}

export function subscribeRoom(
  code: string,
  handlers: {
    onRoom: (room: Room) => void
    onParticipants: (list: Participant[]) => void
    onMessages: (list: Message[]) => void
  },
): () => void {
  if (roomsBackend() === 'firebase') {
    let unsub: (() => void) | null = null
    let cancelled = false
    void fb().then((m) => {
      if (cancelled) return
      unsub = m.fbSubscribeRoom(code, handlers)
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }
  return local.localPollRoom(code, (data) => {
    handlers.onRoom(data.room)
    handlers.onParticipants(data.participants)
    handlers.onMessages(data.messages)
  })
}
