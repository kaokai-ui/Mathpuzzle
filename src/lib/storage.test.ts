import { describe, expect, it } from 'vitest'

import { validateProgress, validateSettings } from './storage'
import { DEFAULT_SETTINGS } from './game'

function makeValidProgress() {
  return {
    puzzle: {
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
    },
    grid: [
      [0, 0],
      [0, 0],
    ],
    hintsLeft: 3,
    selectedCell: { row: 0, col: 0 },
    elapsedSeconds: 0,
    status: 'playing',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('validateSettings', () => {
  it('無效輸入時回傳預設值', () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(validateSettings({ difficulty: 'nope', timerEnabled: 'yes' })).toEqual(DEFAULT_SETTINGS)
  })

  it('保留合法欄位', () => {
    expect(validateSettings({ difficulty: 'hard', timerEnabled: false })).toEqual({
      difficulty: 'hard',
      timerEnabled: false,
    })
  })
})

describe('validateProgress', () => {
  it('接受合法的進度資料', () => {
    expect(validateProgress(makeValidProgress())).not.toBeNull()
  })

  it('拒絕 numPool 長度與棋盤不符', () => {
    const data = makeValidProgress()
    data.puzzle.numPool = [1, 2, 3]
    expect(validateProgress(data)).toBeNull()
  })

  it('拒絕解答數字重複或超出範圍', () => {
    const duplicated = makeValidProgress()
    duplicated.puzzle.solution = [
      [1, 1],
      [3, 2],
    ]
    expect(validateProgress(duplicated)).toBeNull()

    const outOfRange = makeValidProgress()
    outOfRange.puzzle.solution = [
      [1, 9],
      [3, 2],
    ]
    expect(validateProgress(outOfRange)).toBeNull()
  })

  it('拒絕盤面數值超出範圍', () => {
    const data = makeValidProgress()
    data.grid = [
      [0, 99],
      [0, 0],
    ]
    expect(validateProgress(data)).toBeNull()
  })

  it('拒絕提示次數超過難度上限', () => {
    const data = makeValidProgress()
    data.hintsLeft = 99
    expect(validateProgress(data)).toBeNull()
  })

  it('拒絕運算子數量與棋盤不符', () => {
    const data = makeValidProgress()
    data.puzzle.rowOps = [['+', '+'], ['+']]
    expect(validateProgress(data)).toBeNull()
  })

  it('拒絕選取格超出棋盤範圍', () => {
    const data = makeValidProgress()
    data.selectedCell = { row: 5, col: 0 }
    expect(validateProgress(data)).toBeNull()
  })
})
