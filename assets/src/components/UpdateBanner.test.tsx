import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UpdateBanner from '@/components/UpdateBanner';

describe('UpdateBanner', () => {
  it('announces the update and reloads on demand', () => {
    const onReload = vi.fn();
    render(<UpdateBanner onReload={onReload} />);

    expect(screen.getByText('A new version of Blunderfest is available.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalled();
  });
});
