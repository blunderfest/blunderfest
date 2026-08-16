import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, panel, panelHeader } from '@/components/ui';
import { useAppSelector } from '@/store';

/**
 * The room's chat panel: op-log-backed history (replays on join), live for
 * everyone in the room. Sits in the rail under Members. Sending is a plain
 * `chat` op — the echo is the only application path (ADR-0005).
 */
export default function ChatPanel({ onSend }: { onSend: (text: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const messages = useAppSelector((state) => state.room.chatMessages);
  const names = useAppSelector((state) => state.room.names);
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
    <section className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-col`}>
      <div className={panelHeader()}>
        <h2 className="m-0">{t('chat.title')}</h2>
        <span className="text-faint tabular-nums">{messages.length}</span>
      </div>
      <ul
        ref={listRef}
        data-testid="chat-list"
        className="m-0 flex min-h-24 max-h-56 flex-1 flex-col gap-1 overflow-y-auto p-2"
      >
        {messages.length === 0 && <li className="p-1 text-ui text-faint">{t('chat.empty')}</li>}
        {messages.map((message) => (
          <li key={message.seq} className="text-ui leading-snug">
            <span className="font-semibold text-gold-hi">
              {names[message.author] ?? message.author}
            </span>{' '}
            <span className="text-ink">{message.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t border-line p-2">
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
    </section>
  );
}
