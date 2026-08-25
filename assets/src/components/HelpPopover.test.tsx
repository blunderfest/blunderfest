import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HelpPopover from '@/components/HelpPopover';

function renderPopover() {
  return render(
    <HelpPopover label="What does this mean?">
      <p>Explainer content</p>
    </HelpPopover>,
  );
}

describe('HelpPopover', () => {
  it('opens the explainer on click and closes on the backdrop', () => {
    renderPopover();

    expect(screen.queryByText('Explainer content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'What does this mean?' }));
    expect(screen.getByText('Explainer content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Explainer content')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'What does this mean?' }));
    expect(screen.getByText('Explainer content')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Explainer content')).not.toBeInTheDocument();
  });

  it('toggles on repeated clicks', () => {
    renderPopover();

    const button = screen.getByRole('button', { name: 'What does this mean?' });
    fireEvent.click(button);
    expect(screen.getByText('Explainer content')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText('Explainer content')).not.toBeInTheDocument();
  });
});
