import { DEFAULT_SETTINGS, DIFFICULTY_CONFIGS } from './game'
import type { DifficultyKey, GameProgress, Settings } from './types'

const SETTINGS_KEY = 'math-puzzle-settings'
const LEGACY_SETTINGS_KEY = 'crossmath-settings'
const GAME_KEY = 'math-puzzle-progress'
const LEGACY_GAME_KEY = 'crossmath-progress'

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 儲存空間滿或無法使用時，寧可放棄保存也不要讓遊戲中斷
  }
}

function removeItem(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // 同上，移除失敗不影響遊戲進行
  }
}

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

function isValidDifficultyKey(value: unknown): value is DifficultyKey {
  return typeof value === 'string' && value in DIFFICULTY_CONFIGS
}

export function validateSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_SETTINGS
  }

  const partial = raw as Record<string, unknown>
  return {
    difficulty: isValidDifficultyKey(partial.difficulty) ? partial.difficulty : DEFAULT_SETTINGS.difficulty,
    timerEnabled: typeof partial.timerEnabled === 'boolean' ? partial.timerEnabled : DEFAULT_SETTINGS.timerEnabled,
  }
}

const VALID_OPERATORS = new Set<string>(['+', '-', '*', '/'])

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function isNestedNumberArray(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every((row) => isNumberArray(row))
}

function isBooleanArray(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'boolean')
}

function isNestedBooleanArray(value: unknown): value is boolean[][] {
  return Array.isArray(value) && value.every((row) => isBooleanArray(row))
}

function isOperatorArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && VALID_OPERATORS.has(item))
}

function isNestedOperatorArray(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((row) => isOperatorArray(row))
}

export function validateProgress(raw: unknown): GameProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const data = raw as Record<string, unknown>

  if (!data.puzzle || typeof data.puzzle !== 'object' || Array.isArray(data.puzzle)) {
    return null
  }

  const puzzle = data.puzzle as Record<string, unknown>

  if (typeof puzzle.size !== 'number' || puzzle.size < 2 || puzzle.size > 5) {
    return null
  }

  if (typeof puzzle.id !== 'string' || !isValidDifficultyKey(puzzle.difficulty)) {
    return null
  }

  const cellCount = puzzle.size * puzzle.size

  if (!isNestedNumberArray(puzzle.solution) || puzzle.solution.length !== puzzle.size) {
    return null
  }

  if (puzzle.solution.some((row) => row.length !== puzzle.size)) {
    return null
  }

  const solutionValues = puzzle.solution.flat()
  if (solutionValues.some((value) => !Number.isInteger(value) || value < 1 || value > cellCount)) {
    return null
  }

  if (new Set(solutionValues).size !== cellCount) {
    return null
  }

  if (!isNestedBooleanArray(puzzle.given) || puzzle.given.length !== puzzle.size) {
    return null
  }

  if (puzzle.given.some((row) => row.length !== puzzle.size)) {
    return null
  }

  if (!isNumberArray(puzzle.numPool) || puzzle.numPool.length !== cellCount) {
    return null
  }

  if (!isNestedOperatorArray(puzzle.rowOps) || puzzle.rowOps.length !== puzzle.size) {
    return null
  }

  if (!isNestedOperatorArray(puzzle.colOps) || puzzle.colOps.length !== puzzle.size) {
    return null
  }

  if (puzzle.rowOps.some((ops) => ops.length !== (puzzle.size as number) - 1)) {
    return null
  }

  if (puzzle.colOps.some((ops) => ops.length !== (puzzle.size as number) - 1)) {
    return null
  }

  if (!isNumberArray(puzzle.rowResults) || puzzle.rowResults.length !== puzzle.size) {
    return null
  }

  if (!isNumberArray(puzzle.colResults) || puzzle.colResults.length !== puzzle.size) {
    return null
  }

  if (typeof puzzle.createdAt !== 'string') {
    return null
  }

  if (!isNestedNumberArray(data.grid) || data.grid.length !== puzzle.size) {
    return null
  }

  if (data.grid.some((row) => row.length !== puzzle.size)) {
    return null
  }

  if (data.grid.flat().some((value) => !Number.isInteger(value) || value < 0 || value > cellCount)) {
    return null
  }

  const maxHints = DIFFICULTY_CONFIGS[puzzle.difficulty].hints
  if (
    typeof data.hintsLeft !== 'number' ||
    !Number.isInteger(data.hintsLeft) ||
    data.hintsLeft < 0 ||
    data.hintsLeft > maxHints
  ) {
    return null
  }

  if (typeof data.elapsedSeconds !== 'number' || data.elapsedSeconds < 0) {
    return null
  }

  if (data.status !== 'playing' && data.status !== 'won') {
    return null
  }

  if (data.selectedCell !== null && data.selectedCell !== undefined) {
    if (typeof data.selectedCell !== 'object' || Array.isArray(data.selectedCell)) {
      return null
    }
    const cell = data.selectedCell as Record<string, unknown>
    if (typeof cell.row !== 'number' || typeof cell.col !== 'number') {
      return null
    }
    if (cell.row < 0 || cell.row >= puzzle.size || cell.col < 0 || cell.col >= puzzle.size) {
      return null
    }
  }

  return data as unknown as GameProgress
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  const raw = safeParse<unknown>(readItem(SETTINGS_KEY) ?? readItem(LEGACY_SETTINGS_KEY))
  return validateSettings(raw)
}

export function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') {
    return
  }

  writeItem(SETTINGS_KEY, JSON.stringify(settings))
  removeItem(LEGACY_SETTINGS_KEY)
}

export function loadProgress(): GameProgress | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = safeParse<unknown>(readItem(GAME_KEY) ?? readItem(LEGACY_GAME_KEY))
  return validateProgress(raw)
}

export function saveProgress(progress: GameProgress | null): void {
  if (typeof window === 'undefined') {
    return
  }

  if (progress) {
    writeItem(GAME_KEY, JSON.stringify(progress))
    removeItem(LEGACY_GAME_KEY)
    return
  }

  removeItem(GAME_KEY)
  removeItem(LEGACY_GAME_KEY)
}
