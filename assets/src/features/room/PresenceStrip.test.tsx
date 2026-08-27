import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PresenceStrip from '@/features/room/PresenceStrip';
import type { PresenceMember } from '@/protocol/ops';

const members: PresenceMember[] = [
  { id: 'p1', name: 'Brave Otter' },
  { id: 'me', name: 'Calm Fox' },
];

function renderStrip(overrides: Partial<Parameters<typeof PresenceStrip>[0]> = {}) {
  return render(
    <PresenceStrip
      members={members}
      roles={{ p1: 'owner', me: 'viewer' }}
      presenterId="p1"
      myRole="viewer"
      selfId="me"
      following
      onFollowChange={vi.fn()}
      onSetRole={vi.fn()}
      {...overrides}
    />,
  );
}

/** The member rows live in the strip's popover (ADR-0031). */
function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: '2 members' }));
}

describe('PresenceStrip', () => {
  it('shows an avatar per member; the list opens as a popover', () => {
    renderStrip();

    expect(screen.queryByTestId('member-list')).not.toBeInTheDocument();
    openPopover();
    expect(screen.getByTestId('member-list')).toBeInTheDocument();
    expect(screen.getByText('Brave Otter')).toBeInTheDocument();
    expect(screen.getByText('Calm Fox')).toBeInTheDocument();
  });

  it('collapses beyond four members into a +N marker', () => {
    const many: PresenceMember[] = [
      { id: 'a', name: 'One A' },
      { id: 'b', name: 'Two B' },
      { id: 'c', name: 'Three C' },
      { id: 'd', name: 'Four D' },
      { id: 'e', name: 'Five E' },
      { id: 'f', name: 'Six F' },
    ];
    renderStrip({ members: many });

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders nothing when the room is empty', () => {
    const { container } = renderStrip({ members: [] });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('PresenceStrip follow toggle', () => {
  it('shows the following state on the presenter row', () => {
    renderStrip();
    openPopover();

    const toggle = screen.getByRole('button', { name: 'Following presenter' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the follow state when broken away', () => {
    renderStrip({ following: false });
    openPopover();

    const toggle = screen.getByRole('button', { name: 'Follow presenter' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks the parent to re-follow on click', () => {
    const onFollowChange = vi.fn();
    renderStrip({ following: false, onFollowChange });
    openPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Follow presenter' }));

    expect(onFollowChange).toHaveBeenCalledWith(true);
  });

  it('shows no toggle for the presenter themselves', () => {
    renderStrip({ selfId: 'p1', myRole: 'owner' });
    openPopover();

    expect(screen.queryByRole('button', { name: 'Follow presenter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Following presenter' })).not.toBeInTheDocument();
  });

  it('shows no toggle without a presenter', () => {
    renderStrip({ presenterId: null });
    openPopover();

    expect(screen.queryByRole('button', { name: 'Follow presenter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Following presenter' })).not.toBeInTheDocument();
  });
});
