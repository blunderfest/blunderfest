import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SidebarTabs from '@/features/analysis/SidebarTabs';

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
    expect(screen.queryByText('content-a')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Explorer' })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders the active tab’s caption when it has one', () => {
    render(
      <SidebarTabs
        tabs={[
          { id: 'a', label: 'Eval', content: <p>content-a</p>, caption: 'What the eval shows' },
          { id: 'b', label: 'Material', content: <p>content-b</p> },
        ]}
      />,
    );
    expect(screen.getByText('What the eval shows')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Material' }));
    expect(screen.queryByText('What the eval shows')).not.toBeInTheDocument();
  });
});
