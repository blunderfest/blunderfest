import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';
import { useRoomSelector } from '@/store/roomContext';

/**
 * The room's chat: op-log-backed history (replays on join), live for
 * everyone in the room. A sidebar tab since ADR-0031 (it was a rail panel);
 * the tab carries an unread badge. Sending is a plain `chat` op — the echo
 * is the only application path (ADR-0005).
 *
 * Chat is for owners and collaborators; viewers read along (ADR-0023), so
 * the input only renders with `canChat`. The owner (`canModerate`) can
 * delete a message — a `delete_chat` op, filtered out of view on every
 * client, the original op staying in the log.
 */
export default function ChatPanel({
  onSend,
  onDelete,
  canChat,
  canModerate,
}: {
  onSend: (text: string) => void;
  onDelete: (seq: number) => void;
  /** Owners/collaborators can post; viewers only read (ADR-0023). */
  canChat: boolean;
  /** The owner can delete any message (moderation). */
  canModerate: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const messages = useRoomSelector((ctx) => ctx.chatMessages);
  const names = useRoomSelector((ctx) => ctx.names);
  const listRef = useRef<HTMLUListElement | null>(null);
  const lastSeq = messages.length > 0 ? messages[messages.length - 1].seq : 0;

  // Keep the newest message in view — scoped to the list, never the page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSeq is the trigger, not a referenced value
  useEffect(() => {
    const list = listRef.current;
    if (list !== null) {
      list.scrollTop = list.scrollHeight;
    }
  }, [lastSeq]);

  function send() {
    const text = draft.trim();
    if (text === '') {
      return;
    }
    onSend(text.slice(0, 500));
    setDraft('');
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('chat.title')}>
      <ul
        ref={listRef}
        data-testid="chat-list"
        className="m-0 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2"
      >
        {messages.length === 0 && <li className="p-1 text-ui text-faint">{t('chat.empty')}</li>}
        {messages.map((message) => (
          <li key={message.seq} className="flex items-start gap-1 text-ui leading-snug">
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-gold-hi">
                {names[message.author] ?? message.author_name ?? message.author}
              </span>{' '}
              <span className="text-ink">{message.text}</span>
            </span>
            {canModerate && (
              <button
                type="button"
                data-testid={`chat-delete-${message.seq}`}
                aria-label={t('chat.delete')}
                title={t('chat.delete')}
                className={`${button({ intent: 'quiet', size: 'xs' })} shrink-0`}
                onClick={() => onDelete(message.seq)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {canChat ? (
        <div className="flex shrink-0 gap-2 border-t border-line p-2">
          <input
            type="text"
            id="chat-input"
            aria-label={t('chat.placeholder')}
            placeholder={t('chat.placeholder')}
            maxLength={500}
            className="min-w-0 flex-1 rounded-control border border-line bg-transparent px-2 py-1 text-ui text-ink outline-none placeholder:text-faint focus:border-line-strong"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                send();
              }
            }}
          />
          <button
            type="button"
            id="chat-send-button"
            aria-label={t('chat.send')}
            className={button({ intent: 'secondary', size: 'sm' })}
            disabled={draft.trim() === ''}
            onClick={send}
          >
            {t('chat.send')}
          </button>
        </div>
      ) : (
        <p className="m-0 border-t border-line p-2 text-note text-faint">{t('chat.readOnly')}</p>
      )}
    </section>
  );
}
