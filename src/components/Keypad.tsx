import type { CSSProperties } from 'react'

import { getPlacementState, isLargeBoard } from '../lib/game'
import type { GameProgress } from '../lib/types'

type KeypadItem =
  | { type: 'number'; value: number }
  | { type: 'erase' }
  | { type: 'hint' }

function getKeypadItems(
  values: number[],
  isTablet: boolean,
  isHardBoard: boolean,
): KeypadItem[] {
  if (isTablet && isHardBoard) {
    return [
      ...values.slice(0, 8).map((value) => ({ type: 'number' as const, value })),
      { type: 'erase' as const },
      ...values.slice(8).map((value) => ({ type: 'number' as const, value })),
      { type: 'hint' as const },
    ]
  }

  return [
    ...values.map((value) => ({ type: 'number' as const, value })),
    { type: 'erase' as const },
    { type: 'hint' as const },
  ]
}

interface KeypadProps {
  game: GameProgress
  keypadStyle: CSSProperties
  isTabletViewport: boolean
  onInputNumber: (value: number) => void
  onEraseCell: () => void
  onUseHint: () => void
}

export function Keypad({
  game,
  keypadStyle,
  isTabletViewport,
  onInputNumber,
  onEraseCell,
  onUseHint,
}: KeypadProps) {
  const keypadItems = getKeypadItems(game.puzzle.numPool, isTabletViewport, isLargeBoard(game.puzzle))
  const { completed: completedNumbers, used: usedNumbers } = getPlacementState(game)

  return (
    <section className="keypad-card card-surface" style={keypadStyle}>
      <div className="keypad-grid">
        {keypadItems.map((item) => {
          if (item.type === 'number') {
            const value = item.value
            const isCompleted = completedNumbers.has(value)
            const isUsed = !isCompleted && (usedNumbers.get(value) ?? 0) > 0

            return (
              <button
                key={value}
                type="button"
                className={`keypad-button ${isCompleted ? 'is-complete' : ''} ${isUsed ? 'is-used' : ''}`}
                onClick={() => onInputNumber(value)}
                disabled={isCompleted || isUsed}
              >
                {value}
              </button>
            )
          }

          if (item.type === 'erase') {
            return (
              <button
                key="erase"
                type="button"
                className="keypad-button is-tool"
                onClick={onEraseCell}
                disabled={!game.selectedCell}
              >
                清除
              </button>
            )
          }

          return (
            <button
              key="hint"
              type="button"
              className="keypad-button is-tool"
              onClick={onUseHint}
              disabled={game.hintsLeft <= 0}
            >
              提示
            </button>
          )
        })}
      </div>
    </section>
  )
}
