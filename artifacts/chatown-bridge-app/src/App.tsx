import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Header } from './components/Header'
import { SpeakerPanel } from './components/SpeakerPanel'
import { TextInputBar } from './components/TextInputBar'
import { RoomLobby } from './components/RoomLobby'
import { QRCodeCard } from './components/QRCodeCard'
import { ExtrasDrawer } from './components/ExtrasDrawer'
import { BossListenPanel } from './components/BossListenPanel'
import { translate, ApiError } from './lib/api'
import { SpeechSession, isSpeechSupported } from './lib/speech'
import { speak, checkVoice, stopSpeaking, unlockAudio } from './lib/tts'
import { loadMessages, saveMessage, clearMessages, getSetting, setSetting } from './lib/store'
import { loadGlossary, ensureGlossary } from './lib/glossary'
import { romanize } from './lib/romanize'
import {
  createRoom,
  joinRoom,
  postRoomMessage,
  setSpeaking,
  subscribeRoom,
  roomsBackend,
} from './lib/rooms'
import type {
  AppMode,
  GlossaryEntry,
  Lang,
  Message,
  Participant,
  Room,
  SpeechStatus,
} from './lib/types'

const SPEAKER_BN = 'local-bn'
const SPEAKER_ZH = 'local-zh'

type Screen = 'main' | 'lobby' | 'qr'

function parseJoinCodeFromUrl(): string | null {
  try {
    const u = new URL(window.location.href)
    const c = u.searchParams.get('room') || u.pathname.match(/\/r\/([A-Za-z0-9]+)/)?.[1]
    return c ? c.toUpperCase() : null
  } catch {
    return null
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [autoPlay, setAutoPlay] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [statusBn, setStatusBn] = useState<SpeechStatus>('idle')
  const [statusZh, setStatusZh] = useState<SpeechStatus>('idle')
  const [interimBn, setInterimBn] = useState('')
  const [interimZh, setInterimZh] = useState('')
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const [speechOk, setSpeechOk] = useState(true)

  const [mode, setMode] = useState<AppMode>('local')
  /** dual = face-to-face split; boss = boss speaks zh, you hear bn aloud */
  const [layoutMode, setLayoutMode] = useState<'dual' | 'boss'>('boss')
  const [lastBnAloud, setLastBnAloud] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('main')
  const [room, setRoom] = useState<Room | null>(null)
  const [me, setMe] = useState<Participant | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [lobbyBusy, setLobbyBusy] = useState(false)
  const [lobbyError, setLobbyError] = useState<string | null>(null)
  const [initialCode] = useState(() => parseJoinCodeFromUrl())

  const [extrasOpen, setExtrasOpen] = useState(false)
  const [showRomanization, setShowRomanization] = useState(false)
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([])

  const speechBn = useRef<SpeechSession | null>(null)
  const speechZh = useRef<SpeechSession | null>(null)
  const autoPlayRef = useRef(autoPlay)
  const glossaryRef = useRef(glossary)
  const modeRef = useRef(mode)
  const roomRef = useRef(room)
  const meRef = useRef(me)
  const layoutModeRef = useRef(layoutMode)
  const lastPlayedId = useRef<string | null>(null)

  autoPlayRef.current = autoPlay
  layoutModeRef.current = layoutMode
  glossaryRef.current = glossary
  modeRef.current = mode
  roomRef.current = room
  meRef.current = me

  const showToast = useCallback((msg: string, ms = 4000) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), ms)
  }, [])

  const speakingName = useMemo(() => {
    const s = room?.speaking
    if (!s) return null
    if (s.until && s.until < Date.now()) return null
    if (me && s.participantId === me.id) return null
    return s.name
  }, [room, me])

  const speakingBlocked = Boolean(speakingName)

  // boot
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [msgs, ap, rom, layout, gloss] = await Promise.all([
        loadMessages(),
        getSetting('autoPlay', true),
        getSetting('showRomanization', false),
        getSetting<'dual' | 'boss'>('layoutMode', 'boss'),
        loadGlossary(),
      ])
      if (cancelled) return
      setMessages(msgs)
      // Boss/meeting default: speak aloud. Respect saved false only in dual mode.
      const layoutResolved = layout === 'dual' ? 'dual' : 'boss'
      setLayoutMode(layoutResolved)
      setAutoPlay(layoutResolved === 'boss' ? true : ap)
      setShowRomanization(rom)
      setGlossary(gloss)
      setSpeechOk(isSpeechSupported())
      if (!isSpeechSupported()) showToast('Speech not supported — use typed input.', 6000)
      const [bnV, zhV] = await Promise.all([checkVoice('bn'), checkVoice('zh')])
      const notices = [bnV.notice, zhV.notice].filter(Boolean)
      if (notices.length) setVoiceNotice(notices.join(' '))
      if (initialCode) setScreen('lobby')
    })()
    return () => {
      cancelled = true
    }
  }, [showToast, initialCode])

  // speech sessions
  useEffect(() => {
    speechBn.current = new SpeechSession({
      onInterim: (t) => setInterimBn(t),
      onStatus: (s) => setStatusBn(s),
      onError: (e) => {
        setStatusBn(e.code === 'permission-denied' ? 'denied' : 'error')
        showToast(e.message)
        setInterimBn('')
        void releaseSpeakLock()
      },
    })
    speechZh.current = new SpeechSession({
      onInterim: (t) => setInterimZh(t),
      onStatus: (s) => setStatusZh(s),
      onError: (e) => {
        setStatusZh(e.code === 'permission-denied' ? 'denied' : 'error')
        showToast(e.message)
        setInterimZh('')
        void releaseSpeakLock()
      },
    })
    return () => {
      speechBn.current?.abort?.()
      speechZh.current?.abort?.()
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep final callbacks fresh
  useEffect(() => {
    speechBn.current?.setCallbacks({
      onFinal: (t) => {
        setInterimBn('')
        void processText(t, 'bn')
      },
    })
    speechZh.current?.setCallbacks({
      onFinal: (t) => {
        setInterimZh('')
        void processText(t, 'zh')
      },
    })
  })

  // shared room subscription
  useEffect(() => {
    if (mode !== 'shared' || !room) return
    const unsub = subscribeRoom(room.code, {
      onRoom: (r) => setRoom(r),
      onParticipants: setParticipants,
      onMessages: (list) => {
        setMessages(list)
        // auto-play newest message for my language if from others
        const last = list[list.length - 1]
        if (!last || last.id === lastPlayedId.current) return
        if (!autoPlayRef.current) return
        if (meRef.current && last.speakerId === meRef.current.id) return
        const myLang = meRef.current?.lang
        if (!myLang) return
        const text =
          last.translations[myLang] ||
          (last.srcLang === myLang ? last.srcText : undefined)
        if (text) {
          lastPlayedId.current = last.id
          if (myLang === 'bn') setLastBnAloud(text)
          unlockAudio()
          void speak(text, myLang, { rate: myLang === 'bn' ? 0.88 : 0.92 })
        }
      },
    })
    return unsub
  }, [mode, room?.code])

  async function releaseSpeakLock() {
    const r = roomRef.current
    const m = meRef.current
    if (modeRef.current === 'shared' && r && m) {
      try {
        await setSpeaking(r.code, null)
      } catch {
        /* ignore */
      }
    }
  }

  async function acquireSpeakLock() {
    const r = roomRef.current
    const m = meRef.current
    if (modeRef.current === 'shared' && r && m) {
      try {
        await setSpeaking(r.code, { participantId: m.id, name: m.name })
      } catch {
        /* ignore */
      }
    }
  }

  async function processText(text: string, from: Lang, speakerOverride?: Partial<Message>) {
    const trimmed = text.trim()
    if (!trimmed) {
      setStatusBn('idle')
      setStatusZh('idle')
      await releaseSpeakLock()
      return
    }
    const to: Lang = from === 'bn' ? 'zh' : 'bn'
    setBusy(true)
    if (from === 'bn') setStatusBn('processing')
    else setStatusZh('processing')

    const t0 = performance.now()
    try {
      let translation: string
      // phrase-like exact glossary hit
      const glossHit = glossaryRef.current.find(
        (g) =>
          g.from === from &&
          g.to === to &&
          g.source.toLowerCase() === trimmed.toLowerCase(),
      )
      if (glossHit) {
        translation = glossHit.target
      } else {
        const res = await translate(trimmed, from, to)
        translation = ensureGlossary(trimmed, res.translation, from, to, glossaryRef.current)
      }

      const msg: Message = {
        id: uuidv4(),
        speakerId:
          speakerOverride?.speakerId ||
          (modeRef.current === 'shared' && meRef.current
            ? meRef.current.id
            : from === 'bn'
              ? SPEAKER_BN
              : SPEAKER_ZH),
        speakerName:
          speakerOverride?.speakerName ||
          (modeRef.current === 'shared' && meRef.current
            ? meRef.current.speakerLabel || meRef.current.name
            : from === 'bn'
              ? 'বাংলা'
              : '中文'),
        srcLang: from,
        srcText: trimmed,
        translations: {
          bn: from === 'bn' ? trimmed : translation,
          zh: from === 'zh' ? trimmed : translation,
        },
        romanizations: {
          bn: await romanize(from === 'bn' ? trimmed : translation, 'bn'),
          zh: await romanize(from === 'zh' ? trimmed : translation, 'zh'),
        },
        ts: Date.now(),
      }

      if (modeRef.current === 'shared' && roomRef.current) {
        await postRoomMessage(roomRef.current.code, msg)
        // subscription will update list; optimistic:
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      } else {
        setMessages((prev) => [...prev, msg])
        await saveMessage(msg)
      }

      const elapsed = performance.now() - t0
      if (elapsed > 4000) {
        console.warn(`[perf] translation ${elapsed.toFixed(0)}ms`)
      }

      // Boss / meeting: always speak the side you need to understand
      const lm = layoutModeRef.current
      const shouldSpeak = autoPlayRef.current || lm === 'boss'
      if (shouldSpeak) {
        lastPlayedId.current = msg.id
        const aloudLang = lm === 'boss' ? ('bn' as const) : to
        const aloudText =
          lm === 'boss' ? msg.translations.bn || translation : translation
        if (aloudLang === 'bn') setLastBnAloud(aloudText)
        unlockAudio()
        const result = await speak(aloudText, aloudLang, {
          rate: aloudLang === 'bn' ? 0.88 : 0.92,
        })
        if (!result.ok && result.notice) showToast(result.notice)
      }
    } catch (err) {
      const m =
        err instanceof ApiError
          ? err.code === 'rate_limit'
            ? 'Rate limit — wait a moment and try again.'
            : err.message
          : err instanceof Error
            ? err.message
            : 'Translation failed'
      showToast(m)
    } finally {
      setBusy(false)
      setStatusBn('idle')
      setStatusZh('idle')
      await releaseSpeakLock()
    }
  }

  function startMic(lang: Lang) {
    if (speakingBlocked) {
      showToast(`${speakingName} is speaking — wait`)
      return
    }
    unlockAudio()
    stopSpeaking()
    void acquireSpeakLock()
    if (lang === 'bn') {
      speechZh.current?.abort?.()
      setStatusZh('idle')
      speechBn.current?.start('bn')
    } else {
      speechBn.current?.abort?.()
      setStatusBn('idle')
      speechZh.current?.start('zh')
    }
  }

  function stopMic(lang: Lang) {
    if (lang === 'bn') speechBn.current?.stop()
    else speechZh.current?.stop()
  }

  async function handleClear() {
    if (!confirm('Clear local transcript? (Shared room history stays on server until TTL)')) return
    if (mode === 'local') {
      await clearMessages()
      setMessages([])
    } else {
      showToast('Clear only affects local cache; leave room to reset view')
      setMessages([])
    }
  }

  async function handleAutoPlay(v: boolean) {
    setAutoPlay(v)
    await setSetting('autoPlay', v)
  }

  function handleSend(text: string, from: Lang) {
    if (speakingBlocked) {
      showToast(`${speakingName} is speaking — wait`)
      return
    }
    void acquireSpeakLock().then(() => processText(text, from))
  }

  async function handleCreateRoom(name: string, lang: Lang) {
    setLobbyBusy(true)
    setLobbyError(null)
    try {
      const res = await createRoom({ name, lang })
      setRoom(res.room)
      setMe(res.participant)
      setParticipants([res.participant])
      setMode('shared')
      setMessages([])
      setScreen('qr')
      const url = new URL(window.location.href)
      url.searchParams.set('room', res.room.code)
      window.history.replaceState({}, '', url.toString())
      showToast(`Room ${res.room.code} created (${roomsBackend()})`)
    } catch (e) {
      setLobbyError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setLobbyBusy(false)
    }
  }

  async function handleJoinRoom(code: string, name: string, lang: Lang, speakerLabel?: string) {
    setLobbyBusy(true)
    setLobbyError(null)
    try {
      const res = await joinRoom(code, { name, lang, speakerLabel })
      setRoom(res.room)
      setMe(res.participant)
      setMode('shared')
      setScreen('main')
      const url = new URL(window.location.href)
      url.searchParams.set('room', res.room.code)
      window.history.replaceState({}, '', url.toString())
      showToast(`Joined ${res.room.code}`)
    } catch (e) {
      setLobbyError(e instanceof Error ? e.message : 'Join failed')
    } finally {
      setLobbyBusy(false)
    }
  }

  function leaveRoom() {
    setMode('local')
    setRoom(null)
    setMe(null)
    setParticipants([])
    setScreen('main')
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    window.history.replaceState({}, '', url.toString())
    void loadMessages().then(setMessages)
  }

  function upgradeToShared() {
    setScreen('lobby')
  }

  const shareUrl =
    room && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${room.code}`
      : ''

  // Shared mode: one panel for my language. Local mode: dual split-screen.
  const sharedSingleLang = mode === 'shared' && Boolean(me)

  return (
    <ErrorBoundary>
      <div className="flex h-full min-h-[100dvh] flex-col bg-slate-950 text-slate-100">
        <Header
          autoPlay={autoPlay}
          onAutoPlayChange={handleAutoPlay}
          onClear={() => void handleClear()}
          modeLabel={
            mode === 'shared'
              ? 'Shared'
              : layoutMode === 'boss'
                ? 'Boss · aloud'
                : 'Local dual'
          }
          roomCode={room?.code}
          speakingName={speakingName}
          onShare={mode === 'shared' && room ? () => setScreen('qr') : upgradeToShared}
          onLobby={() => setScreen(screen === 'lobby' ? 'main' : 'lobby')}
          onExtras={() => setExtrasOpen(true)}
          layoutMode={layoutMode}
          onLayoutModeChange={(m) => {
            setLayoutMode(m)
            void setSetting('layoutMode', m)
            if (m === 'boss') {
              setAutoPlay(true)
              void setSetting('autoPlay', true)
              showToast('Boss mode: Chinese in → Bangla spoken aloud')
            }
          }}
        />

        {voiceNotice && (
          <div
            className="border-b border-amber-800/40 bg-amber-950/40 px-3 py-1.5 text-center text-[11px] text-amber-200"
            role="status"
          >
            {voiceNotice}
          </div>
        )}

        {!speechOk && (
          <div
            className="border-b border-slate-700 bg-slate-900 px-3 py-1.5 text-center text-[11px] text-slate-300"
            role="status"
          >
            Mic speech unavailable — typed input works.
          </div>
        )}

        {screen === 'lobby' && (
          <RoomLobby
            initialCode={initialCode || undefined}
            busy={lobbyBusy}
            error={lobbyError}
            onBack={() => {
              setScreen('main')
              setLobbyError(null)
            }}
            onCreate={handleCreateRoom}
            onJoin={handleJoinRoom}
          />
        )}

        {screen === 'qr' && room && (
          <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-6">
            <p className="text-sm text-slate-300">Scan to join · backend: {roomsBackend()}</p>
            <QRCodeCard url={shareUrl} code={room.code} />
            <p className="text-xs text-slate-500">
              {participants.length} participant{participants.length === 1 ? '' : 's'} · max 10
            </p>
            <ul className="w-full max-w-sm text-sm text-slate-400">
              {participants.map((p) => (
                <li key={p.id} className="flex justify-between border-b border-slate-800 py-1">
                  <span>
                    {p.name}
                    {p.speakerLabel ? ` (${p.speakerLabel})` : ''}
                  </span>
                  <span>{p.lang}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold"
                onClick={() => setScreen('main')}
              >
                Continue
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm"
                onClick={leaveRoom}
              >
                Leave room
              </button>
            </div>
          </div>
        )}

        {screen === 'main' && (
          <>
            {mode === 'shared' && me && (
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1 text-[11px] text-slate-400">
                <span>
                  You: {me.name}
                  {me.speakerLabel ? ` · ${me.speakerLabel}` : ''} · {me.lang}
                </span>
                <button type="button" className="text-teal-400" onClick={leaveRoom}>
                  Leave
                </button>
              </div>
            )}

            {layoutMode === 'boss' && mode === 'local' ? (
              <BossListenPanel
                messages={messages}
                status={statusZh}
                interim={interimZh}
                disabled={busy || speakingBlocked}
                lastTranslation={lastBnAloud}
                onHoldStart={() => startMic('zh')}
                onHoldEnd={() => stopMic('zh')}
                onReplay={() => {
                  if (!lastBnAloud) return
                  unlockAudio()
                  void speak(lastBnAloud, 'bn', { rate: 0.88 })
                }}
                banner={
                  statusZh === 'denied'
                    ? 'Mic denied — allow microphone for Chinese speech'
                    : voiceNotice
                }
                showRomanization={showRomanization}
              />
            ) : !sharedSingleLang ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <SpeakerPanel
                  lang="zh"
                  messages={messages}
                  flipped
                  status={statusZh}
                  interim={interimZh}
                  disabled={busy || speakingBlocked}
                  onPressStart={() => startMic('zh')}
                  onPressEnd={() => stopMic('zh')}
                  banner={statusZh === 'denied' ? 'Mic denied' : null}
                  showRomanization={showRomanization}
                />
                <div className="h-px shrink-0 bg-slate-700" aria-hidden />
                <SpeakerPanel
                  lang="bn"
                  messages={messages}
                  status={statusBn}
                  interim={interimBn}
                  disabled={busy || speakingBlocked}
                  onPressStart={() => startMic('bn')}
                  onPressEnd={() => stopMic('bn')}
                  banner={statusBn === 'denied' ? 'Mic denied' : null}
                  showRomanization={showRomanization}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <SpeakerPanel
                  lang={me!.lang}
                  messages={messages}
                  status={me!.lang === 'bn' ? statusBn : statusZh}
                  interim={me!.lang === 'bn' ? interimBn : interimZh}
                  disabled={busy || speakingBlocked}
                  onPressStart={() => startMic(me!.lang)}
                  onPressEnd={() => stopMic(me!.lang)}
                  showRomanization={showRomanization}
                />
              </div>
            )}

            <TextInputBar
              disabled={busy || speakingBlocked}
              defaultLang={me?.lang || (layoutMode === 'boss' ? 'zh' : 'bn')}
              onSend={handleSend}
            />
          </>
        )}

        <ExtrasDrawer
          open={extrasOpen}
          onClose={() => setExtrasOpen(false)}
          messages={messages}
          viewLang={me?.lang || 'bn'}
          showRomanization={showRomanization}
          onShowRomanization={(v) => {
            setShowRomanization(v)
            void setSetting('showRomanization', v)
          }}
          glossary={glossary}
          onGlossaryChange={setGlossary}
          onUsePhrase={(bn, zh, from) => {
            void (async () => {
              const text = from === 'bn' ? bn : zh
              const msg: Message = {
                id: uuidv4(),
                speakerId: me?.id || (from === 'bn' ? SPEAKER_BN : SPEAKER_ZH),
                speakerName: me?.name || (from === 'bn' ? 'বাংলা' : '中文'),
                srcLang: from,
                srcText: text,
                translations: { bn, zh },
                romanizations: {
                  bn: await romanize(bn, 'bn'),
                  zh: await romanize(zh, 'zh'),
                },
                ts: Date.now(),
              }
              if (mode === 'shared' && room) {
                await postRoomMessage(room.code, msg)
                setMessages((p) => (p.some((m) => m.id === msg.id) ? p : [...p, msg]))
              } else {
                setMessages((p) => [...p, msg])
                await saveMessage(msg)
              }
              if (autoPlay) {
                const to: typeof from = from === 'bn' ? 'zh' : 'bn'
                await speak(to === 'bn' ? bn : zh, to)
              }
            })()
          }}
        />

        {toast && (
          <div
            className="pointer-events-none fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2 text-center text-sm text-slate-100 shadow-xl ring-1 ring-slate-600"
            role="status"
            aria-live="assertive"
          >
            {toast}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
