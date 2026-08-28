import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import RegionChip from '@/features/room/RegionChip';
import roomReducer, { setRegion, setRoomRegion } from '@/store/room';

function renderChip(region: string | null, roomRegion: string | null = null) {
  const store = configureStore({ reducer: { room: roomReducer } });
  store.dispatch(setRegion(region));
  store.dispatch(setRoomRegion(roomRegion));
  return render(
    <Provider store={store}>
      <RegionChip />
    </Provider>,
  );
}

describe('RegionChip', () => {
  it('renders nothing before the join reply supplies a region', () => {
    renderChip(null);
    expect(screen.queryByTestId('region-chip')).toBeNull();
  });

  it('shows the single region when the room is co-located', () => {
    renderChip('ams');
    expect(screen.getByTestId('region-chip')).toHaveTextContent('ams');
  });

  it('shows both regions split when the room lives elsewhere', () => {
    renderChip('ams', 'ord');
    expect(screen.getByTestId('region-chip')).toHaveTextContent('ams↔ord');
  });
});
