import type { ReactNode } from 'react';
import { useState } from 'react';

export type SidebarTab = {
  id: string;
  label: string;
  content: ReactNode;
};

/**
 * The tabbed container for the analysis sidebar. Built to give future panels
 * (Explorer, Search) a home without fighting the move list for space. The tab
 * strip only renders once more than one tab exists — a single tab shows its
 * content directly, so today's layout is unchanged.
 */
export default function SidebarTabs({ tabs }: { tabs: SidebarTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');

  if (tabs.length === 1) {
    return <>{tabs[0].content}</>;
  }

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex shrink-0 border-b border-line bg-surface/70">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current.id}
            className={`flex-1 border-b-2 py-2 text-center text-ui font-semibold transition-colors ${
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
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
        {current.content}
      </div>
    </div>
  );
}
