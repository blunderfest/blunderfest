import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SidebarTabs from '@/features/analysis/SidebarTabs';

describe('SidebarTabs', () => {
  it('renders a single tab directly without a tab strip', () => {
    render(<SidebarTabs tabs={[{ id: 'a', label: 'Analysis', content: <p>content-a</p> }]} />);
    expect(screen.getByText('content-a')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
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
    expect(screen.queryByText('content-a')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Explorer' })).toHaveAttribute('aria-selected', 'true');
  });
});
