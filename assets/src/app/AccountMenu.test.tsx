import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountMenu from '@/app/AccountMenu';
import type { Profile } from '@/lib/api';

const profile: Profile = { id: 'profile-1', name: 'Brave Otter 42', created_at: '' };
const linked: Profile = {
  ...profile,
  accounts: [{ type: 'lichess', username: 'dr_ny', linked_at: '' }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('AccountMenu', () => {
  it('shows the fun name and the anonymous state', () => {
    render(<AccountMenu profile={profile} />);

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(screen.getByText('Anonymous device')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Link Lichess account' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Recover with Lichess' })).toBeInTheDocument();
  });

  it('shows the linked Lichess account and hides the link action', () => {
    render(<AccountMenu profile={linked} />);

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(screen.getByText('Lichess: dr_ny')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Link Lichess account' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Recover with Lichess' })).toBeInTheDocument();
  });

  it('starts the flow with the device credentials for linking', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ url: 'https://lichess.org/oauth?state=abc' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<AccountMenu profile={profile} />);

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Link Lichess account' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/auth/lichess/start');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer the-secret');
    expect(JSON.parse(String(init?.body))).toEqual({ profile_id: 'profile-1' });
  });

  it('closes the menu on Escape', () => {
    render(<AccountMenu profile={profile} />);

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('unlinks with the device credentials and hides the link', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ profile: linked }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<AccountMenu profile={linked} />);

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('Lichess: dr_ny')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Unlink Lichess account' }));

    await screen.findByText('Anonymous device');
    expect(screen.queryByText('Lichess: dr_ny')).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/auth/unlink');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer the-secret');
  });
});
