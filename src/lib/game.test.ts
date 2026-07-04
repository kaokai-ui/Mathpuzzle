import { describe, expect, it } from 'vitest'

import {
  applyHint,
  canPlaceNumber,
  DIFFICULTY_CONFIGS,
  evaluateExpression,
  findHintTarget,
  generatePuzzle,
  getCompletedNumbers,
  getLineState,
  isPuzzleSolved,
  setCellValue,
} from './game'
import type { DifficultyKey, GameProgress, PuzzleDefinition } from './types'

// 2x2 測試謎題：解答 [[1,4],[3,2]]
// 橫列：1+4=5、3+2=5；直行：1+3=4、4+2=6
// 這組等式存在第二組合法解 [[3,2],[1,4]]，用來驗證勝利判定不依賴逐格比對。
function makePuzzle(overrides: Partial<PuzzleDefinition> = {}): PuzzleDefinition {
  return {
    id: 'test-puzzle',
    difficulty: 'easy',
    size: 2,
    numPool: [1, 2, 3, 4],
    solution: [
      [1, 4],
      [3, 2],
    ],
    given: [
      [false, false],
      [false, false],
    ],
    rowOps: [['+'], ['+']],
    colOps: [['+'], ['+']],
    rowResults: [5, 5],
    colResults: [4, 6],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeProgress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    puzzle: makePuzzle(),
    grid: [
      [0, 0],
      [0, 0],
    ],
    hintsLeft: 3,
    selectedCell: { row: 0, col: 0 },
    elapsedSeconds: 0,
    status: 'playing',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('evaluateExpression', () => {
  it('先乘除後加減', () => {
    expect(evaluateExpression([2, 3, 4], ['+', '*'])).toBe(14)
    expect(evaluateExpression([8, 4, 2], ['/', '+'])).toBe(4)
  })

  it('除不盡或除以零時回傳 null', () => {
    expect(evaluateExpression([7, 2], ['/'])).toBeNull()
    expect(evaluateExpression([5, 0], ['/'])).toBeNull()
  })

  it('允許負數結果', () => {
    expect(evaluateExpression([1, 5], ['-'])).toBe(-4)
  })
})

describe('getLineState', () => {
  it('尚未填滿時為 idle', () => {
    expect(getLineState([1, 0], ['+'], 5)).toBe('idle')
  })

  it('依結果判定 correct / wrong', () => {
    expect(getLineState([1, 4], ['+'], 5)).toBe('correct')
    expect(getLineState([1, 4], ['+'], 6)).toBe('wrong')
    expect(getLineState([7, 2], ['/'], 3)).toBe('wrong')
  })
})

describe('isPuzzleSolved', () => {
  it('填入預存解答時過關', () => {
    const progress = makeProgress({
      grid: [
        [1, 4],
        [3, 2],
      ],
    })
    expect(isPuzzleSolved(progress)).toBe(true)
  })

  it('填入另一組滿足所有等式的合法解也算過關', () => {
    const progress = makeProgress({
      grid: [
        [3, 2],
        [1, 4],
      ],
    })
    expect(isPuzzleSolved(progress)).toBe(true)
  })

  it('有重複數字時不算過關', () => {
    const progress = makeProgress({
      grid: [
        [1, 4],
        [1, 4],
      ],
    })
    expect(isPuzzleSolved(progress)).toBe(false)
  })

  it('等式不成立時不算過關', () => {
    const progress = makeProgress({
      grid: [
        [1, 2],
        [3, 4],
      ],
    })
    expect(isPuzzleSolved(progress)).toBe(false)
  })
})

describe('setCellValue', () => {
  it('填入最後一格且等式成立時狀態變為 won', () => {
    const progress = makeProgress({
      grid: [
        [3, 2],
        [1, 0],
      ],
    })
    const next = setCellValue(progress, 1, 1, 4)
    expect(next.status).toBe('won')
    expect(next.grid[1][1]).toBe(4)
  })

  it('清除格子後狀態為 playing', () => {
    const progress = makeProgress({
      grid: [
        [1, 4],
        [3, 0],
      ],
    })
    const next = setCellValue(progress, 0, 0, 0)
    expect(next.status).toBe('playing')
    expect(next.grid[0][0]).toBe(0)
  })
})

describe('canPlaceNumber', () => {
  it('禁止填入已在其它格使用的數字', () => {
    const progress = makeProgress({
      grid: [
        [0, 4],
        [0, 0],
      ],
      selectedCell: { row: 1, col: 1 },
    })
    expect(canPlaceNumber(progress, 4, 1, 1).allowed).toBe(false)
  })

  it('允許同一格重複填入相同數字', () => {
    const progress = makeProgress({
      grid: [
        [0, 4],
        [0, 0],
      ],
    })
    expect(canPlaceNumber(progress, 4, 0, 1).allowed).toBe(true)
  })

  it('禁止修改題目給定的格子', () => {
    const progress = makeProgress({
      puzzle: makePuzzle({
        given: [
          [true, false],
          [false, false],
        ],
      }),
      grid: [
        [1, 0],
        [0, 0],
      ],
    })
    expect(canPlaceNumber(progress, 2, 0, 0).allowed).toBe(false)
  })
})

describe('getCompletedNumbers', () => {
  it('數字所屬行列等式都成立才算完成', () => {
    const progress = makeProgress({
      grid: [
        [1, 4],
        [3, 0],
      ],
    })
    // 只有 (0,0) 的 1 所屬的列與行都完整且正確；4 和 3 各有一條線尚未填滿
    expect(getCompletedNumbers(progress)).toEqual(new Set([1]))

    const solved = makeProgress({
      grid: [
        [1, 4],
        [3, 2],
      ],
    })
    expect(getCompletedNumbers(solved)).toEqual(new Set([1, 2, 3, 4]))
  })
})

describe('applyHint', () => {
  it('填入提示前會先清掉放錯位置的相同數字', () => {
    const progress = makeProgress({
      grid: [
        [0, 0],
        [0, 1],
      ],
    })
    const next = applyHint(progress, { row: 0, col: 0 })
    expect(next.grid[0][0]).toBe(1)
    expect(next.grid[1][1]).toBe(0)
    expect(next.hintsLeft).toBe(progress.hintsLeft - 1)
    expect(next.selectedCell).toEqual({ row: 0, col: 0 })
  })
})

describe('findHintTarget', () => {
  it('優先提示目前選取且尚未正確的格子', () => {
    const progress = makeProgress({
      selectedCell: { row: 1, col: 0 },
    })
    expect(findHintTarget(progress)).toEqual({ row: 1, col: 0 })
  })

  it('選取格已正確時改找第一個未正確的格子', () => {
    const progress = makeProgress({
      grid: [
        [1, 0],
        [0, 0],
      ],
      selectedCell: { row: 0, col: 0 },
    })
    expect(findHintTarget(progress)).toEqual({ row: 0, col: 1 })
  })
})

describe('generatePuzzle', () => {
  const difficulties: DifficultyKey[] = ['easy', 'normal', 'hard']

  it.each(difficulties)('%s：產生的謎題結構與等式一致', (difficulty) => {
    const config = DIFFICULTY_CONFIGS[difficulty]

    for (let round = 0; round < 3; round += 1) {
      const puzzle = generatePuzzle(difficulty)

      expect(puzzle.size).toBe(config.size)
      expect(puzzle.numPool).toHaveLength(config.numCount)

      const values = puzzle.solution.flat().sort((a, b) => a - b)
      expect(values).toEqual(Array.from({ length: config.numCount }, (_, index) => index + 1))

      for (let row = 0; row < config.size; row += 1) {
        expect(evaluateExpression(puzzle.solution[row], puzzle.rowOps[row])).toBe(puzzle.rowResults[row])
      }

      for (let col = 0; col < config.size; col += 1) {
        const columnValues = Array.from({ length: config.size }, (_, row) => puzzle.solution[row][col])
        expect(evaluateExpression(columnValues, puzzle.colOps[col])).toBe(puzzle.colResults[col])
      }

      const givenCount = puzzle.given.flat().filter(Boolean).length
      expect(givenCount).toBe(config.prefilled)
    }
  })
})
