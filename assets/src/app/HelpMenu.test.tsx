import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HelpMenu from '@/app/HelpMenu';

describe('HelpMenu', () => {
  it('opens the menu and re-triggers the tour', () => {
    const onStartTour = vi.fn();
    render(<HelpMenu onStartTour={onStartTour} showTour />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Take the guided tour' }));

    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('hides the tour entry outside rooms', () => {
    render(<HelpMenu onStartTour={vi.fn()} showTour={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));

    expect(screen.queryByRole('menuitem', { name: 'Take the guided tour' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('opens the keyboard shortcuts dialog from the menu', () => {
    render(<HelpMenu onStartTour={vi.fn()} showTour />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Keyboard shortcuts' }));

    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('closes the menu on Escape', () => {
    render(<HelpMenu onStartTour={vi.fn()} showTour />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
