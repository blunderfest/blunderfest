import type { HistoricalEvidenceResult } from '@/features/historicalEvidence/types';
import { clearDevice, loadDevice, saveDevice } from '@/lib/device';

export type LinkedAccount = {
  type: string;
  username: string;
  linked_at: string;
};

export type Profile = {
  id: string;
  name: string;
  created_at: string;
  accounts?: LinkedAccount[];
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
 * Starts the Lichess sign-in flow (ADR-0022): one action — the callback
 * binds the account to the current profile when it is new, or adopts the
 * profile the account is already bound to. Device credentials identify
 * the current profile for the bind case. Returns the lichess authorize
 * URL.
 */
export async function lichessAuthStart(device: Device): Promise<{ url: string }> {
  return request('/api/auth/lichess/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${device.secret}`,
    },
    body: JSON.stringify({ profile_id: device.id }),
  });
}

/**
 * Trades the one-time recovery code from the OAuth callback for fresh
 * device credentials.
 */
export async function exchangeAuthCode(
  code: string,
): Promise<{ profile: Profile; secret: string }> {
  return request('/api/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

/**
 * Detaches the lichess account from the profile (and revokes the token
 * server-side). Returns the updated profile.
 */
export async function unlinkLichess(device: Device): Promise<{ profile: Profile }> {
  return request('/api/auth/unlink', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${device.secret}`,
    },
    body: JSON.stringify({ profile_id: device.id }),
  });
}

/**
 * Dispatched when the device identity was swapped mid-session (a 401
 * re-heal): the profile the app holds in state is stale and must be
 * re-read, or the session keeps acting as the OLD profile — e.g. a room
 * created in that moment is owned by the new device while the channel
 * joins as the old one, and the creator lands as a viewer in their own
 * room.
 */
export const DEVICE_REHEALED_EVENT = 'blunderfest:device-rehealed';

/**
 * Re-heals the device identity: a profile whose row is gone (wiped before
 * durable profiles, pruned later) makes every stored device start 401-ing.
 * Drop it and mint a fresh profile, then tell the app so the profile state
 * follows the device.
 */
async function rehealDevice(): Promise<Device | null> {
  clearDevice();
  try {
    const { profile, secret } = await createProfile();
    const device = { id: profile.id, secret };
    saveDevice(device);
    window.dispatchEvent(new CustomEvent(DEVICE_REHEALED_EVENT));
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
  /** The mover's remaining clock after this move, in seconds (from [%clk] at parse time). */
  clock?: number | null;
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

/** A game that failed to parse in a multi-game import (1-based index). */
export type ImportFailure = {
  index: number;
  detail: { reason: string; san?: string; ply?: number };
};

/**
 * Imports a PGN — one or several games (multi-game PGN). Games parse
 * independently: `failures` lists the ones that didn't make it.
 */
export async function importPgn(
  pgn: string,
): Promise<{ trees: GameTree[]; failures: ImportFailure[] }> {
  const body = await request<{
    tree?: GameTree;
    trees?: GameTree[];
    failures?: ImportFailure[];
  }>('/api/import/pgn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pgn }),
  });
  return {
    trees: body.trees ?? (body.tree !== undefined ? [body.tree] : []),
    failures: body.failures ?? [],
  };
}

export async function importLichess(url: string): Promise<{ tree: GameTree }> {
  return request('/api/import/lichess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

/** A lichess study of the linked account (metadata only). */
export type LichessStudy = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
};

/** Lists the linked account's lichess studies (ADR-0022). */
export async function fetchStudies(device: Device): Promise<{ studies: LichessStudy[] }> {
  return request(`/api/lichess/studies?profile_id=${encodeURIComponent(device.id)}`, {
    headers: { Authorization: `Bearer ${device.secret}` },
  });
}

/** Imports a whole lichess study — every chapter becomes a game. */
export async function importLichessStudy(
  device: Device,
  studyId: string,
): Promise<{ trees: GameTree[]; failures: ImportFailure[] }> {
  const body = await request<{
    tree?: GameTree;
    trees?: GameTree[];
    failures?: ImportFailure[];
  }>('/api/import/lichess-study', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${device.secret}`,
    },
    body: JSON.stringify({ profile_id: device.id, study_id: studyId }),
  });
  return {
    trees: body.trees ?? (body.tree !== undefined ? [body.tree] : []),
    failures: body.failures ?? [],
  };
}

/** A recent lichess game of the linked account (metadata only). */
export type LichessGame = {
  id: string;
  white: string;
  black: string;
  result: string;
  date: number;
  speed: string;
};

/** Lists the linked account's recent lichess games (ADR-0022). */
export async function fetchLichessGames(
  device: Device,
  max = 10,
): Promise<{ games: LichessGame[] }> {
  return request(`/api/lichess/games?profile_id=${encodeURIComponent(device.id)}&max=${max}`, {
    headers: { Authorization: `Bearer ${device.secret}` },
  });
}

/** Imports selected lichess games (up to 10 per call). */
export async function importLichessGames(
  device: Device,
  gameIds: string[],
): Promise<{ trees: GameTree[]; failures: ImportFailure[] }> {
  const body = await request<{
    tree?: GameTree;
    trees?: GameTree[];
    failures?: ImportFailure[];
  }>('/api/import/lichess-games', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${device.secret}`,
    },
    body: JSON.stringify({ profile_id: device.id, game_ids: gameIds }),
  });
  return {
    trees: body.trees ?? (body.tree !== undefined ? [body.tree] : []),
    failures: body.failures ?? [],
  };
}

/** A chess.com game from the monthly archive (public API), PGN inline. */
export type ChesscomGame = {
  id: string;
  white: string;
  black: string;
  result: string;
  date: number;
  speed: string;
  pgn: string;
};

/**
 * Lists a chess.com player's games for one month — the official public
 * API only (their terms; see the server module for the full posture).
 */
export async function fetchChesscomGames(
  device: Device,
  username: string,
  year: number,
  month: number,
): Promise<{ games: ChesscomGame[] }> {
  const params = new URLSearchParams({
    profile_id: device.id,
    username,
    year: String(year),
    month: String(month),
  });
  return request(`/api/chesscom/games?${params}`, {
    headers: { Authorization: `Bearer ${device.secret}` },
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

/**
 * The historical-evidence vertical slice: analyze a position against the
 * corpus. `route` is the SAN list leading to the position in the current
 * game (optional — a bare FEN is a valid target).
 */
export async function analyzeHistoricalEvidence(
  fen: string,
  opts?: { route?: string[]; refPly?: number },
): Promise<HistoricalEvidenceResult> {
  return request('/api/historical-evidence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fen,
      route: opts?.route,
      ref_ply: opts?.refPly,
    }),
  });
}

/**
 * A corpus game as a playable tree (mainline only — the corpus drops
 * clocks, comments and variations by design), for the game-view feature.
 */
export async function fetchHistoricalGame(gid: number): Promise<{ tree: GameTree }> {
  return request(`/api/historical-evidence/games/${gid}`);
}

/** One move's opening-book stats (games + W/D/B), from `/api/book`. */
export type BookMove = {
  move: string;
  games: number;
  white: number;
  draw: number;
  black: number;
};

/**
 * The opening-book next-move stats for a FEN (corpus game counts + W/D/B
 * per move). `[]` for a position with no occurrences.
 */
export async function fetchBook(fen: string): Promise<{ moves: BookMove[] }> {
  return request(`/api/book?fen=${encodeURIComponent(fen)}`);
}
