import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RegionChip from '@/features/room/RegionChip';
import { RoomStoreProvider } from '@/store/roomContext';
import { createRoomStore } from '@/store/roomStore';

function renderChip(region: string | null, roomRegion: string | null = null) {
  const store = createRoomStore('test-room');
  store.send({ type: 'region.set', value: region });
  store.send({ type: 'roomRegion.set', value: roomRegion });
  return render(
    <RoomStoreProvider value={store}>
      <RegionChip />
    </RoomStoreProvider>,
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
