import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import RoomPanel from '@/features/room/RoomPanel';
import roomReducer, { setRegion } from '@/store/room';

function renderPanel(onLeave = vi.fn(), region: string | null = 'ams') {
  const store = configureStore({ reducer: { room: roomReducer } });
  store.dispatch(setRegion(region));
  return render(
    <Provider store={store}>
      <RoomPanel slug="abcde" onLeave={onLeave} />
    </Provider>,
  );
}

describe('RoomPanel', () => {
  it('shows the room code and the region chip', () => {
    renderPanel();
    expect(screen.getByText('ABCDE')).toBeInTheDocument();
    expect(screen.getByTestId('region-chip')).toHaveTextContent('🇳🇱 Amsterdam');
  });

  it('calls onLeave from the leave button', () => {
    const onLeave = vi.fn();
    renderPanel(onLeave);
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
