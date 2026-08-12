import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MemberList from '@/features/room/MemberList';
import type { PresenceMember } from '@/protocol/ops';

const members: PresenceMember[] = [
  { id: 'p1', name: 'Brave Otter' },
  { id: 'me', name: 'Calm Fox' },
];

function renderList(overrides: Partial<Parameters<typeof MemberList>[0]> = {}) {
  return render(
    <MemberList
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

describe('MemberList follow toggle', () => {
  it('shows the following state on the presenter row', () => {
    renderList();

    const toggle = screen.getByRole('button', { name: 'Following presenter' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the follow state when broken away', () => {
    renderList({ following: false });

    const toggle = screen.getByRole('button', { name: 'Follow presenter' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks the parent to re-follow on click', () => {
    const onFollowChange = vi.fn();
    renderList({ following: false, onFollowChange });

    fireEvent.click(screen.getByRole('button', { name: 'Follow presenter' }));

    expect(onFollowChange).toHaveBeenCalledWith(true);
  });

  it('shows no toggle for the presenter themselves', () => {
    renderList({ selfId: 'p1', myRole: 'owner' });

    expect(screen.queryByRole('button', { name: 'Follow presenter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Following presenter' })).not.toBeInTheDocument();
  });

  it('shows no toggle without a presenter', () => {
    renderList({ presenterId: null });

    expect(screen.queryByRole('button', { name: 'Follow presenter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Following presenter' })).not.toBeInTheDocument();
  });
});
