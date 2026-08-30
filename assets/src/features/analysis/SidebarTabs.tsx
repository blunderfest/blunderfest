import type { ReactNode } from 'react';
import { useState } from 'react';

export type SidebarTab = {
  id: string;
  label: string;
  /** A small marker on the tab button (e.g. the chat unread count). */
  badge?: ReactNode;
  content: ReactNode;
};

/**
 * The one tab strip (ADR-0031): the room sidebar's tabs, and nested tab
 * groups like Review's Moments | Report | Game info. Every tab's content
 * stays mounted; inactive panels are hidden (the `hidden` attribute removes
 * them from the a11y tree). Panels hold results state (a finished analysis,
 * a chat scrollback) — unmounting on tab switches would lose it.
 *
 * Uncontrolled by default; pass `activeId` + `onActivate` to lift the
 * active tab to the parent (the room keeps it across game switches and
 * resets the chat badge on activation).
 */
export default function SidebarTabs({
  tabs,
  activeId,
  onActivate,
}: {
  tabs: SidebarTab[];
  activeId?: string;
  onActivate?: (id: string) => void;
}) {
  const [internal, setInternal] = useState(tabs[0]?.id ?? '');
  const active = activeId ?? internal;

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  if (current === undefined) {
    return null;
  }

  function activate(id: string) {
    if (onActivate !== undefined) {
      onActivate(id);
    } else {
      setInternal(id);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex shrink-0 border-b border-line bg-surface/70">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current.id}
            className={`relative flex flex-1 items-center justify-center gap-1 py-2 text-center text-note font-semibold uppercase tracking-wide transition-colors ${
              tab.id === current.id ? 'text-gold-hi' : 'text-muted hover:text-ink'
            }`}
            onClick={() => activate(tab.id)}
          >
            {tab.label}
            {tab.badge}
            {tab.id === current.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 bg-gold-hi" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          hidden={tab.id !== current.id}
          className={[
            'min-h-0 flex-col gap-2',
            tab.id === current.id ? 'flex flex-1' : 'hidden',
          ].join(' ')}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
