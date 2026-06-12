export type DifficultyKey = 'easy' | 'normal' | 'hard'
export type Operator = '+' | '-' | '*' | '/'
export type GameStatus = 'playing' | 'won'
export type EquationState = 'idle' | 'correct' | 'wrong'

export interface CellPosition {
  row: number
  col: number
}

export interface DifficultyConfig {
  label: string
  description: string
  size: number
  numCount: number
  hints: number
  prefilled: number
  operators: Operator[]
}

export interface Settings {
  difficulty: DifficultyKey
  timerEnabled: boolean
}

export interface PuzzleDefinition {
  id: string
  difficulty: DifficultyKey
  size: number
  numPool: number[]
  solution: number[][]
  given: boolean[][]
  rowOps: Operator[][]
  colOps: Operator[][]
  rowResults: number[]
  colResults: number[]
  createdAt: string
}

export interface GameProgress {
  puzzle: PuzzleDefinition
  grid: number[][]
  hintsLeft: number
  selectedCell: CellPosition | null
  elapsedSeconds: number
  status: GameStatus
  updatedAt: string
}
