import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Channel } from 'phoenix'
import { useRoomChannel } from './useRoomChannel'
import { useAppSelector } from './store'
import type { Op } from './protocol/ops'

function opLabel(t: TFunction, op: Op): string {
  const ply = op.payload.ply
  switch (op.type) {
    case 'move_at_ply':
      return t('room.move', { ply: op.payload.ply, san: op.payload.san })
    case 'comment_at_ply':
      return t('room.comment', { ply, text: op.payload.text })
    case 'replace_line':
      return t('room.line', { ply })
    case 'add_arrow':
      return t('room.arrow', { ply })
    case 'add_highlight':
      return t('room.highlight', { ply })
    case 'set_cursor':
      return t('room.cursor', { ply })
  }
}

export default function RoomView({
  slug,
  onLeave,
  channelFactory,
}: {
  slug: string
  onLeave: () => void
  channelFactory?: (topic: string) => Channel
}) {
  const { t } = useTranslation()
  const { joined, presence } = useRoomChannel(slug, channelFactory)
  const ops = useAppSelector((state) => state.room.ops)
  const storePresence = useAppSelector((state) => state.room.presence)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(slug)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable (permissions etc.) — nothing to show
    }
  }

  return (
    <main className="flex flex-1 flex-col items-stretch gap-6 p-6">
      <section className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="m-0 text-2xl tracking-[-0.02em]">{t('room.codeLabel')}</h1>
          <code className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-lg tracking-widest">
            {slug.toUpperCase()}
          </code>
          <button
            id="copy-code-button"
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-muted transition-colors hover:border-white/30 hover:text-ink"
            onClick={() => void handleCopy()}
          >
            {copied ? t('room.copied') : t('room.copy')}
          </button>
          {!joined && <p className="m-0 text-sm text-warn">{t('room.connecting')}</p>}
        </div>
        <button
          id="leave-room-button"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-white/30"
          onClick={onLeave}
        >
          {t('room.leave')}
        </button>
      </section>

      <div className="grid flex-1 gap-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="m-0 mb-3 text-sm font-semibold text-muted">{t('room.members')}</h2>
          <ul className="m-0 flex flex-col gap-2 p-0">
            {presence.map((member) => (
              <li key={member.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-ok" />
                {member.name}
              </li>
            ))}
            {presence.length === 0 && <li className="text-sm text-muted">…</li>}
          </ul>
        </aside>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="m-0 mb-3 text-sm font-semibold text-muted">{t('room.activity')}</h2>
          {ops.length === 0 ? (
            <p className="m-0 text-sm text-muted">{t('room.emptyActivity')}</p>
          ) : (
            <ul className="m-0 flex max-h-96 flex-col gap-1 overflow-y-auto p-0">
              {ops.map((op) => (
                <li
                  key={op.seq}
                  className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-1 text-sm hover:bg-white/5"
                >
                  <span>
                    <span className="text-muted">#{op.seq} </span>
                    {opLabel(t, op)}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {storePresence[op.author]?.name ?? op.author}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
