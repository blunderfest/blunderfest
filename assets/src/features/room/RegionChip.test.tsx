import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RegionChip from '@/features/room/RegionChip';

describe('RegionChip', () => {
  it('shows the connection region (flag + name)', () => {
    render(<RegionChip region="ams" />);
    expect(screen.getByTestId('region-chip')).toHaveTextContent('🇳🇱 Amsterdam');
  });

  it('shows unknown region codes as-is, without a flag variant', () => {
    render(<RegionChip region="syd" />);
    const chip = screen.getByTestId('region-chip');
    expect(chip).toHaveTextContent('syd');
    expect(chip.querySelectorAll('span[class*="sm:hidden"]')).toHaveLength(0);
  });

  it('renders nothing before the join reply arrives', () => {
    render(<RegionChip region={null} />);
    expect(screen.queryByTestId('region-chip')).not.toBeInTheDocument();
  });
});
