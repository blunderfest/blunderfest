import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RegionChip from '@/features/room/RegionChip';
import { regionFlag } from '@/lib/region';
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

  it('shows the single region as its country flag when co-located', () => {
    renderChip('ams');
    expect(screen.getByTestId('region-flags')).toHaveTextContent(regionFlag('ams') as string);
  });

  it('shows both country flags when the room lives elsewhere', () => {
    renderChip('ams', 'ord');
    expect(screen.getByTestId('region-flags')).toHaveTextContent(
      `${regionFlag('ams')}↔${regionFlag('ord')}`,
    );
  });

  it('falls back to the raw code for unknown regions', () => {
    renderChip('xyz');
    expect(screen.getByTestId('region-flags')).toHaveTextContent('xyz');
  });
});
