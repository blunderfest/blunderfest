import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ActivityFeed from '@/features/room/ActivityFeed';
import type { Op } from '@/protocol/ops';

function cursorOp(seq: number, author = 'profile-1'): Op {
  return {
    seq,
    author,
    ts: '2026-01-01T00:00:00Z',
    type: 'set_cursor',
    payload: { node_id: seq },
  };
}

describe('ActivityFeed', () => {
  it('flashes only ops that arrive after mount, not the join replay', () => {
    const { rerender } = render(
      <ActivityFeed ops={[cursorOp(1), cursorOp(2)]} presence={{}} names={{}} />,
    );

    let items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].className).not.toContain('animate-arrive');
    expect(items[1].className).not.toContain('animate-arrive');

    rerender(<ActivityFeed ops={[cursorOp(1), cursorOp(2), cursorOp(3)]} presence={{}} names={{}} />);

    items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    // Newest first; only the newly arrived op flashes.
    expect(items[0].className).toContain('animate-arrive');
    expect(items[1].className).not.toContain('animate-arrive');
    expect(items[2].className).not.toContain('animate-arrive');
  });

  it('keeps the author name after the author leaves', () => {
    const { rerender } = render(
      <ActivityFeed
        ops={[cursorOp(1)]}
        presence={{ 'profile-1': { id: 'profile-1', name: 'Brave Otter 42' } }}
        names={{ 'profile-1': 'Brave Otter 42' }}
      />,
    );

    expect(screen.getByText('Brave Otter 42')).toBeInTheDocument();

    rerender(
      <ActivityFeed
        ops={[cursorOp(1)]}
        presence={{}}
        names={{ 'profile-1': 'Brave Otter 42' }}
      />,
    );

    expect(screen.getByText('Brave Otter 42')).toBeInTheDocument();
  });
});
