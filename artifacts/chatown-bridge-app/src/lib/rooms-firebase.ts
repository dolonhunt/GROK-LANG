import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebase, ensureAnonAuth } from './firebase'
import { randomRoomCode } from './device'
import type { Lang, Message, Participant, Room } from './types'

const TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_PARTICIPANTS = 10

export async function fbCreateRoom(host: {
  name: string
  lang: Lang
  deviceId: string
}): Promise<{ room: Room; participant: Participant; uid: string }> {
  const fb = await getFirebase()
  if (!fb) throw new Error('Firebase not configured')
  const uid = (await ensureAnonAuth())!
  const code = randomRoomCode()
  const now = Date.now()
  const room: Room = {
    id: code,
    code,
    createdAt: now,
    expiresAt: now + TTL_MS,
    speaking: null,
    maxParticipants: MAX_PARTICIPANTS,
  }
  const participant: Participant = {
    id: uid,
    uid,
    deviceId: host.deviceId,
    name: host.name,
    lang: host.lang,
    joinedAt: now,
  }
  await setDoc(doc(fb.db, 'rooms', code), {
    ...room,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(fb.db, 'rooms', code, 'participants', uid), participant)
  return { room, participant, uid }
}

export async function fbJoinRoom(
  code: string,
  me: { name: string; lang: Lang; deviceId: string; speakerLabel?: string },
): Promise<{ room: Room; participant: Participant; uid: string }> {
  const fb = await getFirebase()
  if (!fb) throw new Error('Firebase not configured')
  const uid = (await ensureAnonAuth())!
  const c = code.toUpperCase()
  const roomRef = doc(fb.db, 'rooms', c)
  const snap = await getDoc(roomRef)
  if (!snap.exists()) throw new Error('Room not found')
  const room = snap.data() as Room
  if (room.expiresAt && room.expiresAt < Date.now()) throw new Error('Room expired')

  const parts = await getDocs(collection(fb.db, 'rooms', c, 'participants'))
  if (parts.size >= MAX_PARTICIPANTS) throw new Error('Room full (max 10)')

  const participant: Participant = {
    id: uid,
    uid,
    deviceId: me.deviceId,
    name: me.name,
    lang: me.lang,
    speakerLabel: me.speakerLabel,
    joinedAt: Date.now(),
  }
  await setDoc(doc(fb.db, 'rooms', c, 'participants', uid), participant)
  return { room: { ...room, code: c, id: c }, participant, uid }
}

export async function fbPostMessage(code: string, msg: Message): Promise<void> {
  const fb = await getFirebase()
  if (!fb) throw new Error('Firebase not configured')
  await setDoc(doc(fb.db, 'rooms', code.toUpperCase(), 'messages', msg.id), {
    ...msg,
    createdAt: serverTimestamp(),
  })
}

export async function fbSetSpeaking(
  code: string,
  speaking: { participantId: string; name: string; until: number } | null,
): Promise<void> {
  const fb = await getFirebase()
  if (!fb) throw new Error('Firebase not configured')
  await updateDoc(doc(fb.db, 'rooms', code.toUpperCase()), { speaking })
}

export function fbSubscribeRoom(
  code: string,
  handlers: {
    onRoom: (room: Room) => void
    onParticipants: (list: Participant[]) => void
    onMessages: (list: Message[]) => void
  },
): Unsubscribe {
  // Note: caller must have already ensured Firebase; we use sync pattern with cached services
  let unsubAll: Unsubscribe = () => {}
  void getFirebase().then((fb) => {
    if (!fb) return
    const c = code.toUpperCase()
    const u1 = onSnapshot(doc(fb.db, 'rooms', c), (snap) => {
      if (snap.exists()) handlers.onRoom({ ...(snap.data() as Room), code: c, id: c })
    })
    const u2 = onSnapshot(collection(fb.db, 'rooms', c, 'participants'), (snap) => {
      handlers.onParticipants(snap.docs.map((d) => d.data() as Participant))
    })
    const u3 = onSnapshot(
      query(collection(fb.db, 'rooms', c, 'messages'), orderBy('ts', 'asc')),
      (snap) => {
        handlers.onMessages(snap.docs.map((d) => d.data() as Message))
      },
    )
    unsubAll = () => {
      u1()
      u2()
      u3()
    }
  })
  return () => unsubAll()
}
