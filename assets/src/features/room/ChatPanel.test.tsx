import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import ChatPanel from '@/features/room/ChatPanel';
import roomReducer, { applyOp, joinMember } from '@/store/room';

function renderPanel(onSend = vi.fn()) {
  const store = configureStore({ reducer: { room: roomReducer } });
  render(
    <Provider store={store}>
      <ChatPanel onSend={onSend} />
    </Provider>,
  );
  return { store, onSend };
}

describe('ChatPanel', () => {
  it('shows messages with author names', () => {
    const { store } = renderPanel();
    act(() => {
      store.dispatch(joinMember({ id: 'author-1', name: 'Brave Otter 42' }));
      store.dispatch(
        applyOp({
          seq: 1,
          author: 'author-1',
          ts: '2026-01-01T00:00:00Z',
          type: 'chat',
          payload: { text: 'nice tactic!' },
        }),
      );
    });

    expect(screen.getByText('Brave Otter 42')).toBeInTheDocument();
    expect(screen.getByText('nice tactic!')).toBeInTheDocument();
  });

  it('sends the trimmed message on Enter and clears the draft', () => {
    const { onSend } = renderPanel();
    const input = screen.getByLabelText('Message the room...');

    fireEvent.change(input, { target: { value: '  gg wp  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('gg wp');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('sends on the button too and never sends an empty message', () => {
    const { onSend } = renderPanel();
    const button = screen.getByRole('button', { name: 'Send' });

    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Message the room...'), {
      target: { value: 'hi' },
    });
    fireEvent.click(button);

    expect(onSend).toHaveBeenCalledWith('hi');
  });
});
