import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NavControls from '@/features/analysis/NavControls';

function renderControls(currentId = 0, overrides: Partial<Parameters<typeof NavControls>[0]> = {}) {
  return render(
    <NavControls
      navTargets={{ first: 0, prev: null, next: null, last: null }}
      currentId={currentId}
      currentPly={0}
      totalPly={2}
      onSelect={vi.fn()}
      {...overrides}
    />,
  );
}

describe('NavControls', () => {
  it('disables First while already at the first position', () => {
    renderControls(0);
    expect(screen.getByRole('button', { name: 'First' })).toBeDisabled();
  });

  it('enables First away from the first position', () => {
    renderControls(2, { currentPly: 2 });
    expect(screen.getByRole('button', { name: 'First' })).toBeEnabled();
  });

  it('navigates via the buttons', () => {
    const onSelect = vi.fn();
    renderControls(1, {
      navTargets: { first: 0, prev: 0, next: 2, last: 2 },
      currentPly: 1,
      onSelect,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSelect).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('shows the ply counter', () => {
    renderControls(1, { currentPly: 1 });
    expect(screen.getByTestId('ply-counter')).toHaveTextContent('ply 1/2');
  });
});
