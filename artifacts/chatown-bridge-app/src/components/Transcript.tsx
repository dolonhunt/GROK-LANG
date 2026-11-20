import { useEffect, useRef } from 'react'
import type { Message, Lang } from '../lib/types'
import { MessageBubble } from './MessageBubble'

interface Props {
  messages: Message[]
  viewLang: Lang
  emptyHint?: string
  showRomanization?: boolean
}

export function Transcript({ messages, viewLang, emptyHint, showRomanization }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500"
        role="status"
      >
        {emptyHint ?? 'Messages appear here. Hold the mic and speak, or type below.'}
      </div>
    )
  }

  return (
    <div
      className="transcript-scroll flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-2"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          viewLang={viewLang}
          showRomanization={showRomanization}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
