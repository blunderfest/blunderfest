import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import RoomHeader from '@/features/room/RoomHeader';
import roomReducer, { setRegion } from '@/store/room';

function renderHeader(region: string | null) {
  const store = configureStore({ reducer: { room: roomReducer } });
  store.dispatch(setRegion(region));
  return render(
    <Provider store={store}>
      <RoomHeader slug="abcde" onLeave={vi.fn()} />
    </Provider>,
  );
}

describe('RoomHeader region chip', () => {
  it('shows the connection region (flag + name)', () => {
    renderHeader('ams');
    expect(screen.getByTestId('region-chip')).toHaveTextContent('🇳🇱 Amsterdam');
  });

  it('shows unknown region codes as-is, without a flag variant', () => {
    renderHeader('syd');
    const chip = screen.getByTestId('region-chip');
    expect(chip).toHaveTextContent('syd');
    expect(chip.querySelectorAll('span[class*="sm:hidden"]')).toHaveLength(0);
  });

  it('renders nothing before the join reply arrives', () => {
    renderHeader(null);
    expect(screen.queryByTestId('region-chip')).not.toBeInTheDocument();
  });
});
