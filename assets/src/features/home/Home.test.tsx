import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/features/home/Home';

function renderHome(onJoin = vi.fn()) {
  const utils = render(<Home backend="ok" userName="Brave Otter 42" onJoin={onJoin} />);
  return { onJoin, ...utils };
}

function stubCreateRoom(ok = true) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 201 : 422,
    json: async () => (ok ? { code: 'abcde' } : { errors: { code: 'invalid_code' } }),
  } as Response);
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Home', () => {
  it('creates a room on the server before joining with the code', async () => {
    const fetchMock = stubCreateRoom();
    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
    const code = onJoin.mock.calls[0][0] as string;
    expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{5}$/);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms',
      expect.objectContaining({ method: 'POST' }),
    );
    const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(callArgs.body as string).code).toBe(code);
  });

  it('shows an error and stays home when room creation fails', async () => {
    stubCreateRoom(false);
    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    expect(await screen.findByText(/Could not create the room/)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('joins a room with a normalized code', () => {
    const { onJoin } = renderHome();
    fireEvent.change(screen.getByPlaceholderText('Room code'), { target: { value: ' AbC_3-9 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onJoin).toHaveBeenCalledWith('abc39');
  });

  it('explains which characters are disallowed in a room code', () => {
    const { onJoin } = renderHome();
    fireEvent.change(screen.getByPlaceholderText('Room code'), { target: { value: 'abc12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/Codes never contain/)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('shows an error when the code has the wrong length', () => {
    const { onJoin } = renderHome();
    fireEvent.change(screen.getByPlaceholderText('Room code'), {
      target: { value: 'kjhkjhkjhkj' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/Enter a room code/)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('joins a room when pressing Enter in the input', () => {
    const { onJoin } = renderHome();
    fireEvent.change(screen.getByPlaceholderText('Room code'), { target: { value: 'xyz99' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Room code'), { key: 'Enter' });
    expect(onJoin).toHaveBeenCalledWith('xyz99');
  });

  it('shows an error when joining with an empty code', () => {
    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/Enter a room code/)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });
});
