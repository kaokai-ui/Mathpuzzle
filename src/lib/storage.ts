import { DEFAULT_SETTINGS } from './game'
import type { GameProgress, Settings } from './types'

const SETTINGS_KEY = 'math-puzzle-settings'
const LEGACY_SETTINGS_KEY = 'crossmath-settings'
const GAME_KEY = 'math-puzzle-progress'
const LEGACY_GAME_KEY = 'crossmath-progress'

function safeParse<T>(value: string | null): T | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  const saved = safeParse<Partial<Settings>>(
    window.localStorage.getItem(SETTINGS_KEY) ?? window.localStorage.getItem(LEGACY_SETTINGS_KEY),
  )
  return {
    difficulty: saved?.difficulty ?? DEFAULT_SETTINGS.difficulty,
    timerEnabled: saved?.timerEnabled ?? DEFAULT_SETTINGS.timerEnabled,
  }
}

export function saveSettings(settings: Settings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  window.localStorage.removeItem(LEGACY_SETTINGS_KEY)
}

export function loadProgress(): GameProgress | null {
  if (typeof window === 'undefined') {
    return null
  }

  return safeParse<GameProgress>(
    window.localStorage.getItem(GAME_KEY) ?? window.localStorage.getItem(LEGACY_GAME_KEY),
  )
}

export function saveProgress(progress: GameProgress | null): void {
  if (progress) {
    window.localStorage.setItem(GAME_KEY, JSON.stringify(progress))
    window.localStorage.removeItem(LEGACY_GAME_KEY)
    return
  }

  window.localStorage.removeItem(GAME_KEY)
  window.localStorage.removeItem(LEGACY_GAME_KEY)
}
