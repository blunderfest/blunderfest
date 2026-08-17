import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import ChatPanel from '@/features/room/ChatPanel';
import roomReducer, { applyOp, joinMember } from '@/store/room';

function renderPanel({
  onSend = vi.fn(),
  onDelete = vi.fn(),
  canChat = true,
  canModerate = false,
}: {
  onSend?: ReturnType<typeof vi.fn>;
  onDelete?: ReturnType<typeof vi.fn>;
  canChat?: boolean;
  canModerate?: boolean;
} = {}) {
  const store = configureStore({ reducer: { room: roomReducer } });
  render(
    <Provider store={store}>
      <ChatPanel onSend={onSend} onDelete={onDelete} canChat={canChat} canModerate={canModerate} />
    </Provider>,
  );
  return { store, onSend, onDelete };
}

function chatOp(seq: number, text: string, author = 'author-1') {
  return {
    seq,
    author,
    ts: '2026-01-01T00:00:00Z',
    type: 'chat' as const,
    payload: { text },
  };
}

describe('ChatPanel', () => {
  it('shows messages with author names', () => {
    const { store } = renderPanel();
    act(() => {
      store.dispatch(joinMember({ id: 'author-1', name: 'Brave Otter 42' }));
      store.dispatch(applyOp(chatOp(1, 'nice tactic!')));
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

  it('shows no input to viewers — only a read-along hint (ADR-0023)', () => {
    renderPanel({ canChat: false });

    expect(screen.queryByLabelText('Message the room...')).not.toBeInTheDocument();
    expect(screen.getByText('Only the owner and collaborators can chat.')).toBeInTheDocument();
  });

  it('lets the owner delete messages, but not collaborators or viewers', () => {
    const { store, onDelete } = renderPanel({ canModerate: true });
    act(() => {
      store.dispatch(applyOp(chatOp(1, 'oops')));
    });

    fireEvent.click(screen.getByTestId('chat-delete-1'));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('renders no delete buttons without moderation rights', () => {
    const { store } = renderPanel({ canModerate: false });
    act(() => {
      store.dispatch(applyOp(chatOp(1, 'hello')));
    });

    expect(screen.queryByTestId('chat-delete-1')).not.toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
