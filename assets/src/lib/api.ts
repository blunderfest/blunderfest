import { clearDevice, loadDevice, saveDevice } from '@/lib/device';

export type Profile = {
  id: string;
  name: string;
  created_at: string;
};

export type Device = {
  id: string;
  secret: string;
};

export class ApiError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);

  if (!response.ok) {
    let code = 'unknown';
    try {
      const body = (await response.json()) as { errors?: { code?: string } };
      code = body.errors?.code ?? code;
    } catch {
      // non-JSON error body; keep the generic code
    }
    throw new ApiError(code);
  }

  return (await response.json()) as T;
}

export async function createProfile(
  signal?: AbortSignal,
): Promise<{ profile: Profile; secret: string }> {
  return request('/api/profiles', { method: 'POST', signal });
}

/**
 * Re-heals the device identity: the server keeps profiles in memory, so a
 * redeploy wipes them and every stored device starts 401-ing. Drop it and
 * mint a fresh profile.
 */
async function rehealDevice(): Promise<Device | null> {
  clearDevice();
  try {
    const { profile, secret } = await createProfile();
    const device = { id: profile.id, secret };
    saveDevice(device);
    return device;
  } catch {
    return null;
  }
}

/**
 * Runs `fn` with the stored device identity; on an "unauthorized" reply
 * (a wiped profile after a redeploy), re-heals once and retries.
 */
export async function withDeviceRetry<T>(fn: (device: Device) => Promise<T>): Promise<T> {
  let device = loadDevice();
  if (device === null) {
    device = await rehealDevice();
    if (device === null) {
      throw new ApiError('unauthorized');
    }
  }
  try {
    return await fn(device);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'unauthorized') {
      throw error;
    }
    const fresh = await rehealDevice();
    if (fresh === null) {
      throw error;
    }
    return fn(fresh);
  }
}

/**
 * Explicitly creates a room on the server; rooms never exist until this
 * returns. With `tree`, the room is seeded with that game on creation
 * (the library "open in a new room" flow, ADR-0020). With `device`, the
 * creator is recorded as the room's owner right away — without it the
 * room starts ownerless and the first profiled joiner claims ownership.
 */
export async function createRoom(
  code: string,
  tree?: GameTree,
  device?: Device | null,
): Promise<{ code: string }> {
  return request('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(device != null ? authHeaders(device) : {}),
    },
    body: JSON.stringify({
      code,
      ...(tree === undefined ? {} : { tree }),
      ...(device != null ? { profile_id: device.id } : {}),
    }),
  });
}

export async function fetchProfile(device: Device, signal?: AbortSignal): Promise<Profile> {
  const body = await request<{ profile: Profile }>(`/api/profiles/${device.id}`, {
    headers: { Authorization: `Bearer ${device.secret}` },
    signal,
  });
  return body.profile;
}

export type GameNode = {
  id: number;
  ply: number;
  san: string | null;
  from: string | null;
  to: string | null;
  promotion: string | null;
  comment: string | null;
  nags: number[];
  status: string;
  fen: string | null;
  children: GameNode[];
};

export type GameTree = {
  headers: Record<string, string>;
  result: string;
  setup: { fen?: string } | null;
  root: GameNode;
  mainline_ply_count: number;
  node_count: number;
};

export async function importPgn(pgn: string): Promise<{ tree: GameTree }> {
  return request('/api/import/pgn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pgn }),
  });
}

export async function importLichess(url: string): Promise<{ tree: GameTree }> {
  return request('/api/import/lichess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

export type LegalMove = {
  from: string;
  to: string;
  promotion: string | null;
  san: string;
  fen: string;
  status: string;
};

/** A saved game in the per-profile library (ADR-0020). */
export type LibraryEntry = {
  id: string;
  title: string;
  saved_at: string;
  tree: GameTree;
};

function authHeaders(device: Device): Record<string, string> {
  return { Authorization: `Bearer ${device.secret}` };
}

export async function fetchLibrary(device: Device): Promise<LibraryEntry[]> {
  const body = await request<{ entries: LibraryEntry[] }>(`/api/profiles/${device.id}/library`, {
    headers: authHeaders(device),
  });
  return body.entries;
}

export async function saveToLibrary(
  device: Device,
  tree: GameTree,
): Promise<{ id: string; title: string; saved_at: string }> {
  const body = await request<{ entry: { id: string; title: string; saved_at: string } }>(
    `/api/profiles/${device.id}/library`,
    {
      method: 'POST',
      headers: { ...authHeaders(device), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tree }),
    },
  );
  return body.entry;
}

export async function deleteFromLibrary(device: Device, entryId: string): Promise<void> {
  await request(`/api/profiles/${device.id}/library/${entryId}`, {
    method: 'DELETE',
    headers: authHeaders(device),
  });
}

/**
 * A blank game at the starting position, used for "New game" in rooms.
 */
export function emptyGameTree(): GameTree {
  return {
    headers: {},
    result: '*',
    setup: null,
    mainline_ply_count: 0,
    node_count: 1,
    root: {
      id: 0,
      ply: 0,
      san: null,
      from: null,
      to: null,
      promotion: null,
      comment: null,
      nags: [],
      status: 'active',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      children: [],
    },
  };
}
