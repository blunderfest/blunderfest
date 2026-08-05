export type Profile = {
  id: string
  name: string
  created_at: string
}

export type Device = {
  id: string
  secret: string
}

export class ApiError extends Error {
  code: string

  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)

  if (!response.ok) {
    let code = 'unknown'
    try {
      const body = (await response.json()) as { errors?: { code?: string } }
      code = body.errors?.code ?? code
    } catch {
      // non-JSON error body; keep the generic code
    }
    throw new ApiError(code)
  }

  return (await response.json()) as T
}

export async function createProfile(): Promise<{ profile: Profile; secret: string }> {
  return request('/api/profiles', { method: 'POST' })
}

export async function fetchProfile(device: Device): Promise<Profile> {
  const body = await request<{ profile: Profile }>(`/api/profiles/${device.id}`, {
    headers: { Authorization: `Bearer ${device.secret}` },
  })
  return body.profile
}

export type GameNode = {
  id: number
  ply: number
  san: string | null
  from: string | null
  to: string | null
  promotion: string | null
  comment: string | null
  nags: number[]
  status: string
  fen: string | null
  children: GameNode[]
}

export type GameTree = {
  headers: Record<string, string>
  result: string
  setup: { fen?: string } | null
  root: GameNode
  mainline_ply_count: number
  node_count: number
}

export async function importPgn(pgn: string): Promise<{ tree: GameTree }> {
  return request('/api/import/pgn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pgn }),
  })
}

export async function importLichess(url: string): Promise<{ tree: GameTree }> {
  return request('/api/import/lichess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}
