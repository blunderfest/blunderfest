import type { ReactNode } from 'react';
import { useState } from 'react';

export type SidebarTab = {
  id: string;
  label: string;
  content: ReactNode;
  /** One-line explanation of what the tab shows, rendered under the content. */
  caption?: string;
};

/**
 * The tabbed container for the analysis sidebar. Gives future panels
 * (Explorer, Search) a home without fighting the move list for space. The
 * tab strip is always visible — even with a single tab — so the structure is
 * there when the new tabs land.
 */
export default function SidebarTabs({ tabs }: { tabs: SidebarTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  if (current === undefined) {
    return null;
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
            className={`flex-1 border-b-2 py-2 text-center text-micro font-semibold uppercase tracking-[0.11em] transition-colors ${
              tab.id === current.id
                ? 'border-gold text-gold-hi'
                : 'border-transparent text-muted hover:text-ink'
            }`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col gap-2">
        {current.content}
        {current.caption !== undefined && (
          // Fixed height (two text-note lines): the box stays the same size
          // no matter which tab is active.
          <p className="m-0 h-9 shrink-0 overflow-hidden px-3 pb-1 text-note text-faint">
            {current.caption}
          </p>
        )}
      </div>
    </div>
  );
}
