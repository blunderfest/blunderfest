import type { ReactNode } from 'react';
import { useState } from 'react';

export type SidebarTab = {
  id: string;
  label: string;
  content: ReactNode;
};

/**
 * The tabbed container for the analysis sidebar. Gives future panels
 * (Explorer, Search) a home without fighting the move list for space. The
 * tab strip is always visible — even with a single tab — so the structure is
 * there when the new tabs land.
 *
 * Every tab's content stays mounted; inactive panels are hidden (the
 * `hidden` attribute removes them from the a11y tree). Panels like the
 * Examples tab hold results state — unmounting on tab switches would lose
 * a finished analysis for no reason.
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
