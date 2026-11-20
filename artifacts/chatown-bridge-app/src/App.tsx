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
  LayoutMode,
  Message,
  Participant,
  Room,
  SpeechStatus,
  UserLang,
} from './lib/types'

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

/** Build full translation map en/bn/zh for a message */
async function fillTranslations(
  text: string,
  from: Lang,
  glossary: GlossaryEntry[],
): Promise<{ bn?: string; zh?: string; en?: string }> {
  const out: { bn?: string; zh?: string; en?: string } = {}
  out[from] = text
  const targets: Lang[] = (['en', 'bn', 'zh'] as Lang[]).filter((l) => l !== from)
  await Promise.all(
    targets.map(async (to) => {
      try {
        const glossHit = glossary.find(
          (g) =>
            g.from === from &&
            g.to === to &&
            g.source.toLowerCase() === text.toLowerCase(),
        )
        if (glossHit) {
          out[to] = glossHit.target
          return
        }
        const res = await translate(text, from, to)
        out[to] = ensureGlossary(text, res.translation, from, to, glossary)
      } catch {
        /* leave missing */
      }
    }),
  )
  return out
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [autoPlay, setAutoPlay] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [statusEn, setStatusEn] = useState<SpeechStatus>('idle')
  const [statusBn, setStatusBn] = useState<SpeechStatus>('idle')
  const [statusZh, setStatusZh] = useState<SpeechStatus>('idle')
  const [interimEn, setInterimEn] = useState('')
  const [interimBn, setInterimBn] = useState('')
  const [interimZh, setInterimZh] = useState('')
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const [speechOk, setSpeechOk] = useState(true)

  const [mode, setMode] = useState<AppMode>('local')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('boss')
  const [userLang, setUserLang] = useState<UserLang>('en')
  const [lastAloud, setLastAloud] = useState<string | null>(null)
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

  const speechEn = useRef<SpeechSession | null>(null)
  const speechBn = useRef<SpeechSession | null>(null)
  const speechZh = useRef<SpeechSession | null>(null)
  const autoPlayRef = useRef(autoPlay)
  const glossaryRef = useRef(glossary)
  const modeRef = useRef(mode)
  const roomRef = useRef(room)
  const meRef = useRef(me)
  const layoutModeRef = useRef(layoutMode)
  const userLangRef = useRef(userLang)
  const lastPlayedId = useRef<string | null>(null)

  autoPlayRef.current = autoPlay
  glossaryRef.current = glossary
  modeRef.current = mode
  roomRef.current = room
  meRef.current = me
  layoutModeRef.current = layoutMode
  userLangRef.current = userLang

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

  const setStatus = (lang: Lang, s: SpeechStatus) => {
    if (lang === 'en') setStatusEn(s)
    else if (lang === 'bn') setStatusBn(s)
    else setStatusZh(s)
  }
  const setInterim = (lang: Lang, t: string) => {
    if (lang === 'en') setInterimEn(t)
    else if (lang === 'bn') setInterimBn(t)
    else setInterimZh(t)
  }
  const getStatus = (lang: Lang) =>
    lang === 'en' ? statusEn : lang === 'bn' ? statusBn : statusZh
  const getInterim = (lang: Lang) =>
    lang === 'en' ? interimEn : lang === 'bn' ? interimBn : interimZh

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [msgs, ap, rom, layout, ul, gloss] = await Promise.all([
        loadMessages(),
        getSetting('autoPlay', true),
        getSetting('showRomanization', false),
        getSetting<LayoutMode>('layoutMode', 'boss'),
        getSetting<UserLang>('userLang', 'en'),
        loadGlossary(),
      ])
      if (cancelled) return
      setMessages(msgs)
      const layoutResolved: LayoutMode = layout === 'dual' ? 'dual' : 'boss'
      setLayoutMode(layoutResolved)
      setUserLang(ul === 'bn' ? 'bn' : 'en')
      setAutoPlay(layoutResolved === 'boss' ? true : ap)
      setShowRomanization(rom)
      setGlossary(gloss)
      setSpeechOk(isSpeechSupported())
      if (!isSpeechSupported()) showToast('Speech not supported — use typed input.', 6000)
      const [enV, bnV, zhV] = await Promise.all([
        checkVoice('en'),
        checkVoice('bn'),
        checkVoice('zh'),
      ])
      const notices = [enV.notice, bnV.notice, zhV.notice].filter(Boolean)
      // only show bn notice if user may need bn, always soft
      if (bnV.fallback || !bnV.available) {
        setVoiceNotice(bnV.notice || notices[0] || null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  useEffect(() => {
    const make = (lang: Lang) =>
      new SpeechSession({
        onInterim: (t) => setInterim(lang, t),
        onStatus: (s) => setStatus(lang, s),
        onError: (e) => {
          setStatus(lang, e.code === 'permission-denied' ? 'denied' : 'error')
          showToast(e.message)
          setInterim(lang, '')
          void releaseSpeakLock()
        },
      })
    speechEn.current = make('en')
    speechBn.current = make('bn')
    speechZh.current = make('zh')
    return () => {
      speechEn.current?.abort?.()
      speechBn.current?.abort?.()
      speechZh.current?.abort?.()
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    speechEn.current?.setCallbacks({
      onFinal: (t) => {
        setInterimEn('')
        void processText(t, 'en')
      },
    })
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

  useEffect(() => {
    if (mode !== 'shared' || !room) return
    const unsub = subscribeRoom(room.code, {
      onRoom: (r) => setRoom(r),
      onParticipants: setParticipants,
      onMessages: (list) => {
        setMessages(list)
        const last = list[list.length - 1]
        if (!last || last.id === lastPlayedId.current) return
        if (!autoPlayRef.current) return
        if (meRef.current && last.speakerId === meRef.current.id) return
        const myLang = (meRef.current?.lang || userLangRef.current) as Lang
        const text =
          last.translations[myLang] ||
          (last.srcLang === myLang ? last.srcText : undefined)
        if (text) {
          lastPlayedId.current = last.id
          setLastAloud(text)
          unlockAudio()
          void speak(text, myLang, { rate: myLang === 'bn' ? 0.88 : 1 })
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

  async function processText(text: string, from: Lang) {
    const trimmed = text.trim()
    if (!trimmed) {
      setStatusEn('idle')
      setStatusBn('idle')
      setStatusZh('idle')
      await releaseSpeakLock()
      return
    }
    setBusy(true)
    setStatus(from, 'processing')

    const t0 = performance.now()
    try {
      const translations = await fillTranslations(trimmed, from, glossaryRef.current)
      const msg: Message = {
        id: uuidv4(),
        speakerId:
          modeRef.current === 'shared' && meRef.current
            ? meRef.current.id
            : `local-${from}`,
        speakerName:
          modeRef.current === 'shared' && meRef.current
            ? meRef.current.speakerLabel || meRef.current.name
            : from.toUpperCase(),
        srcLang: from,
        srcText: trimmed,
        translations,
        romanizations: {
          en: translations.en || (from === 'en' ? trimmed : undefined),
          bn: await romanize(translations.bn || (from === 'bn' ? trimmed : '') || '', 'bn'),
          zh: await romanize(translations.zh || (from === 'zh' ? trimmed : '') || '', 'zh'),
        },
        ts: Date.now(),
      }

      if (modeRef.current === 'shared' && roomRef.current) {
        await postRoomMessage(roomRef.current.code, msg)
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      } else {
        setMessages((prev) => [...prev, msg])
        await saveMessage(msg)
      }

      const elapsed = performance.now() - t0
      if (elapsed > 4000) console.warn(`[perf] ${elapsed.toFixed(0)}ms`)

      // Aloud: boss mode prefers user's language; otherwise speak the "other" side
      const lm = layoutModeRef.current
      const ul = userLangRef.current
      const shouldSpeak = autoPlayRef.current || lm === 'boss'
      if (shouldSpeak) {
        let aloudLang: Lang
        let aloudText: string
        if (lm === 'boss') {
          // Chinese in → my lang out; my lang in → Chinese out (for reply check we speak zh to confirm)
          if (from === 'zh') {
            aloudLang = ul
            aloudText = translations[ul] || translations.en || trimmed
          } else {
            aloudLang = 'zh'
            aloudText = translations.zh || trimmed
          }
        } else {
          // dual: speak opposite of source toward china/user
          aloudLang = from === 'zh' ? ul : 'zh'
          aloudText =
            (aloudLang === 'zh' ? translations.zh : translations[aloudLang]) || trimmed
        }
        lastPlayedId.current = msg.id
        setLastAloud(aloudText)
        unlockAudio()
        const result = await speak(aloudText, aloudLang, {
          rate: aloudLang === 'bn' ? 0.88 : aloudLang === 'zh' ? 0.92 : 1,
        })
        if (!result.ok && result.notice) showToast(result.notice)
      }
    } catch (err) {
      const m =
        err instanceof ApiError
          ? err.code === 'rate_limit'
            ? 'Rate limit — wait a moment.'
            : err.message
          : err instanceof Error
            ? err.message
            : 'Translation failed'
      showToast(m)
    } finally {
      setBusy(false)
      setStatusEn('idle')
      setStatusBn('idle')
      setStatusZh('idle')
      await releaseSpeakLock()
    }
  }

  function sessionFor(lang: Lang) {
    return lang === 'en' ? speechEn : lang === 'bn' ? speechBn : speechZh
  }

  function startMic(lang: Lang) {
    if (speakingBlocked) {
      showToast(`${speakingName} is speaking — wait`)
      return
    }
    unlockAudio()
    stopSpeaking()
    void acquireSpeakLock()
    // stop others
    ;(['en', 'bn', 'zh'] as Lang[]).forEach((l) => {
      if (l !== lang) {
        sessionFor(l).current?.abort?.()
        setStatus(l, 'idle')
      }
    })
    sessionFor(lang).current?.start(lang)
  }

  function stopMic(lang: Lang) {
    sessionFor(lang).current?.stop()
  }

  async function handleClear() {
    if (!confirm('Clear transcript?')) return
    if (mode === 'local') {
      await clearMessages()
      setMessages([])
      setLastAloud(null)
    } else {
      setMessages([])
      setLastAloud(null)
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
      showToast(`Room ${res.room.code} (${roomsBackend()})`)
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

  const shareUrl =
    room && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${room.code}`
      : ''

  const sharedSingleLang = mode === 'shared' && Boolean(me)
  const mineStatus = getStatus(userLang)
  const mineInterim = getInterim(userLang)

  return (
    <ErrorBoundary>
      <div className="flex h-full min-h-[100dvh] flex-col text-slate-100">
        <Header
          autoPlay={autoPlay}
          onAutoPlayChange={handleAutoPlay}
          onClear={() => void handleClear()}
          modeLabel={
            mode === 'shared'
              ? 'Shared'
              : layoutMode === 'boss'
                ? 'Boss · aloud'
                : 'Dual'
          }
          roomCode={room?.code}
          speakingName={speakingName}
          onShare={mode === 'shared' && room ? () => setScreen('qr') : () => setScreen('lobby')}
          onLobby={() => setScreen(screen === 'lobby' ? 'main' : 'lobby')}
          onExtras={() => setExtrasOpen(true)}
          layoutMode={layoutMode}
          onLayoutModeChange={(m) => {
            setLayoutMode(m)
            void setSetting('layoutMode', m)
            if (m === 'boss') {
              setAutoPlay(true)
              void setSetting('autoPlay', true)
              showToast(
                userLang === 'bn'
                  ? 'Boss mode: 中文 → বাংলা aloud'
                  : 'Boss mode: 中文 → English aloud',
              )
            }
          }}
          userLang={userLang}
          onUserLangChange={(l) => {
            setUserLang(l)
            void setSetting('userLang', l)
            showToast(l === 'bn' ? 'Output language: বাংলা' : 'Output language: English')
          }}
        />

        {voiceNotice && userLang === 'bn' && (
          <div
            className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] text-amber-100"
            role="status"
          >
            {voiceNotice}
          </div>
        )}

        {!speechOk && (
          <div className="border-b border-white/5 bg-slate-900/80 px-3 py-1.5 text-center text-[11px] text-slate-300">
            Mic unavailable — type messages below.
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
            <p className="text-sm text-slate-300">Scan to join · {roomsBackend()}</p>
            <QRCodeCard url={shareUrl} code={room.code} />
            <p className="text-xs text-slate-500">{participants.length} / 10 participants</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950"
                onClick={() => setScreen('main')}
              >
                Continue
              </button>
              <button
                type="button"
                className="rounded-xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10"
                onClick={leaveRoom}
              >
                Leave
              </button>
            </div>
          </div>
        )}

        {screen === 'main' && (
          <>
            {mode === 'shared' && me && (
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 text-[11px] text-slate-400">
                <span>
                  You: {me.name} · {me.lang.toUpperCase()}
                </span>
                <button type="button" className="text-teal-300" onClick={leaveRoom}>
                  Leave
                </button>
              </div>
            )}

            {layoutMode === 'boss' && mode === 'local' ? (
              <BossListenPanel
                messages={messages}
                userLang={userLang}
                statusZh={statusZh}
                statusMine={mineStatus}
                interimZh={interimZh}
                interimMine={mineInterim}
                disabled={busy || speakingBlocked}
                lastTranslation={lastAloud}
                onHoldZhStart={() => startMic('zh')}
                onHoldZhEnd={() => stopMic('zh')}
                onHoldMineStart={() => startMic(userLang)}
                onHoldMineEnd={() => stopMic(userLang)}
                onReplay={() => {
                  if (!lastAloud) return
                  unlockAudio()
                  void speak(lastAloud, userLang, { rate: userLang === 'bn' ? 0.88 : 1 })
                }}
                banner={
                  statusZh === 'denied' || mineStatus === 'denied'
                    ? 'Microphone denied — enable mic or type'
                    : null
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
                <div className="h-px shrink-0 bg-white/10" aria-hidden />
                <SpeakerPanel
                  lang={userLang}
                  messages={messages}
                  status={mineStatus}
                  interim={mineInterim}
                  disabled={busy || speakingBlocked}
                  onPressStart={() => startMic(userLang)}
                  onPressEnd={() => stopMic(userLang)}
                  showRomanization={showRomanization}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <SpeakerPanel
                  lang={me!.lang}
                  messages={messages}
                  status={getStatus(me!.lang)}
                  interim={getInterim(me!.lang)}
                  disabled={busy || speakingBlocked}
                  onPressStart={() => startMic(me!.lang)}
                  onPressEnd={() => stopMic(me!.lang)}
                  showRomanization={showRomanization}
                />
              </div>
            )}

            <TextInputBar
              disabled={busy || speakingBlocked}
              defaultLang={layoutMode === 'boss' ? 'zh' : userLang}
              allowedLangs={['en', 'bn', 'zh']}
              onSend={handleSend}
            />
          </>
        )}

        <ExtrasDrawer
          open={extrasOpen}
          onClose={() => setExtrasOpen(false)}
          messages={messages}
          viewLang={userLang}
          showRomanization={showRomanization}
          onShowRomanization={(v) => {
            setShowRomanization(v)
            void setSetting('showRomanization', v)
          }}
          glossary={glossary}
          onGlossaryChange={setGlossary}
          onUsePhrase={(phrase, from) => {
            void (async () => {
              const text = phrase[from] || phrase.en
              const msg: Message = {
                id: uuidv4(),
                speakerId: me?.id || 'phrase',
                speakerName: me?.name || 'Phrase',
                srcLang: from,
                srcText: text,
                translations: { en: phrase.en, bn: phrase.bn, zh: phrase.zh },
                ts: Date.now(),
              }
              if (mode === 'shared' && room) {
                await postRoomMessage(room.code, msg)
                setMessages((p) => [...p, msg])
              } else {
                setMessages((p) => [...p, msg])
                await saveMessage(msg)
              }
              if (autoPlay) {
                const aloud = phrase[userLang] || phrase.en
                setLastAloud(aloud)
                await speak(aloud, userLang)
              }
            })()
          }}
        />

        {toast && (
          <div
            className="pointer-events-none fixed bottom-24 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-2xl bg-slate-900/95 px-4 py-2.5 text-center text-sm text-white shadow-2xl ring-1 ring-white/10"
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
