import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import RoomHeader from '@/features/room/RoomHeader';
import roomReducer, { setServerInfo } from '@/store/room';

function renderHeader(serverInfo: { region: string | null; roomRegion: string | null }) {
  const store = configureStore({ reducer: { room: roomReducer } });
  store.dispatch(setServerInfo(serverInfo));
  return render(
    <Provider store={store}>
      <RoomHeader slug="abcde" onLeave={vi.fn()} />
    </Provider>,
  );
}

describe('RoomHeader region chip', () => {
  it('shows the connection region', () => {
    renderHeader({ region: 'ams', roomRegion: 'ams' });
    const chip = screen.getByTestId('region-chip');
    expect(chip).toHaveTextContent('🇳🇱 Amsterdam');
    expect(chip).not.toHaveTextContent('room');
  });

  it('shows both regions when the room process lives elsewhere', () => {
    renderHeader({ region: 'ord', roomRegion: 'ams' });
    expect(screen.getByTestId('region-chip')).toHaveTextContent('🇺🇸 Chicago · room 🇳🇱 Amsterdam');
  });

  it('renders nothing before the join reply arrives', () => {
    renderHeader({ region: null, roomRegion: null });
    expect(screen.queryByTestId('region-chip')).not.toBeInTheDocument();
  });
});
