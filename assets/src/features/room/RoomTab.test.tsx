import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import RoomTab from '@/features/room/RoomTab';
import { emptyGameTree } from '@/lib/api';
import roomReducer, { setRegion } from '@/store/room';

function renderTab(onLeave = vi.fn(), region: string | null = 'ams') {
  const store = configureStore({ reducer: { room: roomReducer } });
  store.dispatch(setRegion(region));
  const tree = emptyGameTree();
  tree.headers.White = 'Alice';
  tree.headers.Black = 'Bob';
  return render(
    <Provider store={store}>
      <RoomTab
        slug="abcde"
        games={{ g1: tree }}
        activeGameId="g1"
        presenterGameId={null}
        canEdit
        onSelectGame={vi.fn()}
        onAddGame={vi.fn()}
        onNewGame={vi.fn()}
        onLeave={onLeave}
      />
    </Provider>,
  );
}

describe('RoomTab', () => {
  it('shows the room code and the region chip', () => {
    renderTab();
    expect(screen.getByText('ABCDE')).toBeInTheDocument();
    expect(screen.getByTestId('region-chip')).toHaveTextContent('🇳🇱 Amsterdam');
  });

  it('calls onLeave from the leave button', () => {
    const onLeave = vi.fn();
    renderTab(onLeave);
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('lists the room games with the import and new-game actions', () => {
    renderTab();
    expect(screen.getByText('Alice – Bob')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import games' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New game' })).toBeInTheDocument();
  });
});
