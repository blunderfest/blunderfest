import type { Device } from '@/lib/api'

const STORAGE_KEY = 'blunderfest.device'

export function loadDevice(): Device | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Device
    return parsed && typeof parsed.id === 'string' && typeof parsed.secret === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function saveDevice(device: Device): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(device))
}

export function clearDevice(): void {
  localStorage.removeItem(STORAGE_KEY)
}
