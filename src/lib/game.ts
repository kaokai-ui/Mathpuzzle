import type {
  CellPosition,
  DifficultyConfig,
  DifficultyKey,
  EquationState,
  GameProgress,
  Operator,
  PuzzleDefinition,
  Settings,
} from './types'

export const DIFFICULTY_CONFIGS: Record<DifficultyKey, DifficultyConfig> = {
  easy: {
    label: '簡單',
    description: '3x3，使用 1 到 9，只有加減。',
    size: 3,
    numCount: 9,
    hints: 3,
    prefilled: 4,
    operators: ['+', '-'],
  },
  normal: {
    label: '普通',
    description: '3x3，使用 1 到 9，加入乘除。',
    size: 3,
    numCount: 9,
    hints: 2,
    prefilled: 3,
    operators: ['+', '-', '*', '/'],
  },
  hard: {
    label: '困難',
    description: '4x4，使用 1 到 16，加入乘除。',
    size: 4,
    numCount: 16,
    hints: 2,
    prefilled: 6,
    operators: ['+', '-', '*', '/'],
  },
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'easy',
  timerEnabled: true,
}

export const OPERATOR_LABELS: Record<Operator, string> = {
  '+': '+',
  '-': '-',
  '*': '×',
  '/': '÷',
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = randomInt(0, index)
    ;[next[index], next[target]] = [next[target], next[index]]
  }

  return next
}

function createMatrix(size: number, initialValue = 0): number[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => initialValue))
}

function createBooleanMatrix(size: number, initialValue = false): boolean[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => initialValue))
}

export function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row])
}

function createPuzzleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `puzzle-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function findFirstEditableCell(given: boolean[][]): CellPosition | null {
  for (let row = 0; row < given.length; row += 1) {
    for (let col = 0; col < given[row].length; col += 1) {
      if (!given[row][col]) {
        return { row, col }
      }
    }
  }

  return null
}

export function formatDuration(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function getUsedNumbers(grid: number[][]): Map<number, number> {
  const used = new Map<number, number>()

  for (const row of grid) {
    for (const value of row) {
      if (!value) {
        continue
      }
      used.set(value, (used.get(value) ?? 0) + 1)
    }
  }

  return used
}

export function getCompletedNumbers(progress: GameProgress): Set<number> {
  const completed = new Set<number>()

  for (let row = 0; row < progress.puzzle.size; row += 1) {
    for (let col = 0; col < progress.puzzle.size; col += 1) {
      const value = progress.grid[row][col]
      if (value && value === progress.puzzle.solution[row][col]) {
        completed.add(value)
      }
    }
  }

  return completed
}

export function canPlaceNumber(progress: GameProgress, value: number, row: number, col: number): { allowed: boolean; reason?: string } {
  if (!isEditableCell(progress, row, col)) {
    return { allowed: false, reason: '此格不可編輯。' }
  }

  if (progress.status === 'won') {
    return { allowed: false, reason: '遊戲已結束。' }
  }

  const completed = getCompletedNumbers(progress)
  if (completed.has(value)) {
    return { allowed: false, reason: `數字 ${value} 已經完成。` }
  }

  const used = getUsedNumbers(progress.grid)
  const currentCellValue = progress.grid[row][col]

  const alreadyUsed = (used.get(value) ?? 0) - (currentCellValue === value ? 1 : 0)
  if (alreadyUsed > 0) {
    return { allowed: false, reason: `數字 ${value} 已在使用中。` }
  }

  return { allowed: true }
}

export function getPlacementState(progress: GameProgress): { completed: Set<number>; used: Map<number, number> } {
  return {
    completed: getCompletedNumbers(progress),
    used: getUsedNumbers(progress.grid),
  }
}

export function applyMove(progress: GameProgress, value: number, row: number, col: number): GameProgress {
  const nextGrid = cloneGrid(progress.grid)
  nextGrid[row][col] = value
  const nextStatus = isPuzzleSolved({ ...progress, grid: nextGrid }) ? 'won' : 'playing'

  return {
    ...progress,
    grid: nextGrid,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  }
}

export function getFilledCount(grid: number[][]): number {
  let count = 0

  for (const row of grid) {
    for (const value of row) {
      if (value) {
        count += 1
      }
    }
  }

  return count
}

export function evaluateExpression(numbers: number[], operators: Operator[]): number | null {
  const workingNumbers = [...numbers]
  const workingOperators = [...operators]

  for (let index = 0; index < workingOperators.length; ) {
    const operator = workingOperators[index]
    if (operator !== '*' && operator !== '/') {
      index += 1
      continue
    }

    const left = workingNumbers[index]
    const right = workingNumbers[index + 1]

    if (operator === '/') {
      if (right === 0 || left % right !== 0) {
        return null
      }
      workingNumbers.splice(index, 2, left / right)
    } else {
      workingNumbers.splice(index, 2, left * right)
    }

    workingOperators.splice(index, 1)
  }

  let result = workingNumbers[0]

  for (let index = 0; index < workingOperators.length; index += 1) {
    result =
      workingOperators[index] === '+'
        ? result + workingNumbers[index + 1]
        : result - workingNumbers[index + 1]
  }

  return Number.isInteger(result) ? result : null
}

function getLineOptions(numbers: number[], operators: Operator[]): Array<{ ops: Operator[]; result: number }> {
  const results: Array<{ ops: Operator[]; result: number }> = []
  const current: Operator[] = []

  function visit(index: number): void {
    if (index === numbers.length - 1) {
      const result = evaluateExpression(numbers, current)
      if (result !== null && result >= 0 && result <= 99) {
        results.push({ ops: [...current], result })
      }
      return
    }

    for (const operator of operators) {
      current.push(operator)
      visit(index + 1)
      current.pop()

      if (results.length >= 24) {
        return
      }
    }
  }

  visit(0)
  return results
}

export function generatePuzzle(difficulty: DifficultyKey): PuzzleDefinition {
  const config = DIFFICULTY_CONFIGS[difficulty]
  const numbers = Array.from({ length: config.numCount }, (_, index) => index + 1)

  for (let attempt = 0; attempt < 12000; attempt += 1) {
    const shuffled = shuffle(numbers)
    const solution = createMatrix(config.size)

    for (let row = 0; row < config.size; row += 1) {
      for (let col = 0; col < config.size; col += 1) {
        solution[row][col] = shuffled[row * config.size + col]
      }
    }

    const rowOptions = solution.map((row) => getLineOptions(row, config.operators))
    if (rowOptions.some((options) => options.length === 0)) {
      continue
    }

    const colOptions = Array.from({ length: config.size }, (_, col) => {
      const values = Array.from({ length: config.size }, (_, row) => solution[row][col])
      return getLineOptions(values, config.operators)
    })

    if (colOptions.some((options) => options.length === 0)) {
      continue
    }

    const rowOps = rowOptions.map((options) => options[randomInt(0, options.length - 1)].ops)
    const rowResults = rowOptions.map((options, index) => {
      const matches = options.filter((option) => option.ops.join('') === rowOps[index].join(''))
      return matches[randomInt(0, matches.length - 1)].result
    })

    const colOps = colOptions.map((options) => options[randomInt(0, options.length - 1)].ops)
    const colResults = colOptions.map((options, index) => {
      const matches = options.filter((option) => option.ops.join('') === colOps[index].join(''))
      return matches[randomInt(0, matches.length - 1)].result
    })

    const given = createBooleanMatrix(config.size)
    const coordinates = shuffle(
      Array.from({ length: config.size * config.size }, (_, index) => ({
        row: Math.floor(index / config.size),
        col: index % config.size,
      })),
    )

    for (let index = 0; index < config.prefilled; index += 1) {
      const coordinate = coordinates[index]
      given[coordinate.row][coordinate.col] = true
    }

    return {
      id: createPuzzleId(),
      difficulty,
      size: config.size,
      numPool: numbers,
      solution,
      given,
      rowOps,
      colOps,
      rowResults,
      colResults,
      createdAt: new Date().toISOString(),
    }
  }

  throw new Error('Unable to generate puzzle')
}

export function createInitialGrid(puzzle: PuzzleDefinition): number[][] {
  const grid = createMatrix(puzzle.size)

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (puzzle.given[row][col]) {
        grid[row][col] = puzzle.solution[row][col]
      }
    }
  }

  return grid
}

export function createNewProgress(difficulty: DifficultyKey): GameProgress {
  const puzzle = generatePuzzle(difficulty)
  return {
    puzzle,
    grid: createInitialGrid(puzzle),
    hintsLeft: DIFFICULTY_CONFIGS[difficulty].hints,
    selectedCell: findFirstEditableCell(puzzle.given),
    elapsedSeconds: 0,
    status: 'playing',
    updatedAt: new Date().toISOString(),
  }
}

export function isEditableCell(progress: GameProgress, row: number, col: number): boolean {
  return !progress.puzzle.given[row][col]
}

export function isPuzzleSolved(progress: GameProgress): boolean {
  for (let row = 0; row < progress.puzzle.size; row += 1) {
    for (let col = 0; col < progress.puzzle.size; col += 1) {
      if (progress.grid[row][col] !== progress.puzzle.solution[row][col]) {
        return false
      }
    }
  }

  return true
}

export function getLineState(numbers: number[], operators: Operator[], target: number): EquationState {
  if (numbers.some((value) => value === 0)) {
    return 'idle'
  }

  const result = evaluateExpression(numbers, operators)
  if (result === null) {
    return 'wrong'
  }

  return result === target ? 'correct' : 'wrong'
}

export function getRowState(progress: GameProgress, row: number): EquationState {
  return getLineState(progress.grid[row], progress.puzzle.rowOps[row], progress.puzzle.rowResults[row])
}

export function getColumnState(progress: GameProgress, col: number): EquationState {
  const values = Array.from({ length: progress.puzzle.size }, (_, row) => progress.grid[row][col])
  return getLineState(values, progress.puzzle.colOps[col], progress.puzzle.colResults[col])
}
