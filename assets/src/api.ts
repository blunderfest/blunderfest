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
