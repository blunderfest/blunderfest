import type { GameTree } from './api'

const STORAGE_KEY = 'blunderfest.game'

let memory: GameTree | null = null

export function setTree(tree: GameTree) {
  memory = tree
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tree))
  } catch {
    // storage unavailable; keep the in-memory copy only
  }
}

export function getTree(): GameTree | null {
  if (memory) return memory

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) memory = JSON.parse(raw) as GameTree
  } catch {
    // corrupt or missing entry; ignore
  }

  return memory
}
