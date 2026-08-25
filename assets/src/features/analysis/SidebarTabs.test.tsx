import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import SidebarTabs from '@/features/analysis/SidebarTabs';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      clicks {count}
    </button>
  );
}

describe('SidebarTabs', () => {
  it('shows the tab strip even with a single tab', () => {
    render(<SidebarTabs tabs={[{ id: 'a', label: 'Analysis', content: <p>content-a</p> }]} />);
    expect(screen.getByText('content-a')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Analysis' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches between tabs when several exist', () => {
    render(
      <SidebarTabs
        tabs={[
          { id: 'a', label: 'Analysis', content: <p>content-a</p> },
          { id: 'b', label: 'Explorer', content: <p>content-b</p> },
        ]}
      />,
    );
    expect(screen.getByText('content-a')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));
    expect(screen.getByText('content-b')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Explorer' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps inactive tab content mounted but hidden (state survives switches)', () => {
    render(
      <SidebarTabs
        tabs={[
          { id: 'a', label: 'Analysis', content: <p>content-a</p> },
          { id: 'b', label: 'Explorer', content: <p>content-b</p> },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));

    // Both contents stay in the document; the inactive panel is hidden.
    const hiddenPanel = screen.getByText('content-a').closest('[role="tabpanel"]');
    expect(hiddenPanel).not.toBeNull();
    expect(hiddenPanel).toHaveAttribute('hidden');
    const activePanel = screen.getByText('content-b').closest('[role="tabpanel"]');
    expect(activePanel).not.toHaveAttribute('hidden');
  });

  it('preserves tab state across switches (panels stay mounted)', () => {
    render(
      <SidebarTabs
        tabs={[
          { id: 'a', label: 'Analysis', content: <Counter /> },
          { id: 'b', label: 'Explorer', content: <p>content-b</p> },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'clicks 0' }));
    expect(screen.getByRole('button', { name: 'clicks 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Analysis' }));

    expect(screen.getByRole('button', { name: 'clicks 1' })).toBeInTheDocument();
  });
});
