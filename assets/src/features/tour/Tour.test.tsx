import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TourStepDef } from '@/features/tour/steps';
import Tour from '@/features/tour/Tour';

const steps: TourStepDef[] = [
  { target: null, titleKey: 'tour.welcomeTitle', bodyKey: 'tour.welcomeBody' },
  { target: '#tour-fixture', titleKey: 'tour.homeCreateTitle', bodyKey: 'tour.homeCreateBody' },
  { target: '#tour-missing', titleKey: 'tour.homeJoinTitle', bodyKey: 'tour.homeJoinBody' },
];

function renderTour(onClose = vi.fn(), defs: TourStepDef[] = steps) {
  const view = render(
    <>
      <div id="tour-fixture" />
      <Tour steps={defs} onClose={onClose} />
    </>,
  );
  return { onClose, ...view };
}

/** i18next splits interpolated values into separate text nodes. */
function progressText(expected: string) {
  return (_: string, element: Element | null) => element?.textContent === expected;
}

describe('Tour', () => {
  it('walks through the resolvable steps and finishes with Done', () => {
    const { onClose } = renderTour();

    // The missing-target step is dropped: 3 defined, 2 shown.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Blunderfest')).toBeInTheDocument();
    expect(screen.getByText(progressText('1 of 2'))).toBeInTheDocument();
    expect(screen.queryByText('Join with a code')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Start a study')).toBeInTheDocument();
    expect(screen.getByText(progressText('2 of 2'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('goes back with the Back button', () => {
    renderTour();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Welcome to Blunderfest')).toBeInTheDocument();
  });

  it('closes on Skip and on Escape', () => {
    const { onClose, unmount } = renderTour();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    const second = renderTour();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it('advances with the arrow keys', () => {
    renderTour();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Start a study')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Welcome to Blunderfest')).toBeInTheDocument();
  });

  it('renders nothing when no step resolves', () => {
    const { container } = renderTour(vi.fn(), [
      { target: '#tour-absent', titleKey: 'tour.homeJoinTitle', bodyKey: 'tour.homeJoinBody' },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });
});
