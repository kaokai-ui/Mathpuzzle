import type { CSSProperties, KeyboardEvent } from 'react'

import { OPERATOR_LABELS, getColumnState, getRowState } from '../lib/game'
import type { CellPosition, EquationState, GameProgress, Operator } from '../lib/types'

function getCellClass(
  progress: GameProgress,
  row: number,
  col: number,
  selectedCell: CellPosition | null,
): string {
  const classes = ['board-cell']

  if (progress.puzzle.given[row][col]) {
    classes.push('is-given')
  } else {
    classes.push('is-editable')
  }

  if (selectedCell?.row === row && selectedCell?.col === col) {
    classes.push('is-selected')
  }

  const value = progress.grid[row][col]
  if (value && value === progress.puzzle.solution[row][col] && !progress.puzzle.given[row][col]) {
    classes.push('is-correct')
  }

  if (value && value !== progress.puzzle.solution[row][col] && !progress.puzzle.given[row][col]) {
    classes.push('is-wrong')
  }

  return classes.join(' ')
}

function getResultClass(state: EquationState): string {
  if (state === 'correct') {
    return 'result-box is-correct'
  }

  if (state === 'wrong') {
    return 'result-box is-wrong'
  }

  return 'result-box'
}

function renderOperator(operator: Operator): string {
  return OPERATOR_LABELS[operator]
}

function buildBoardTrackTemplate(size: number, cellToken: string, opToken: string, eqToken: string, resultToken: string) {
  const tracks: string[] = []

  for (let index = 0; index < size; index += 1) {
    tracks.push(cellToken)
    if (index < size - 1) {
      tracks.push(opToken)
    }
  }

  tracks.push(eqToken, resultToken)
  return tracks.join(' ')
}

interface BoardProps {
  game: GameProgress
  gridStyle: CSSProperties
  onSelectCell: (row: number, col: number) => void
  onBoardKeyDown: (event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) => void
}

export function Board({ game, gridStyle, onSelectCell, onBoardKeyDown }: BoardProps) {
  return (
    <section className="board-card card-surface">
      <div
        className="math-puzzle-board"
        style={{
          ...gridStyle,
          gridTemplateColumns: buildBoardTrackTemplate(
            game.puzzle.size,
            'var(--cell-size)',
            'var(--op-size)',
            'var(--eq-size)',
            'var(--result-size)',
          ),
          gridTemplateRows: buildBoardTrackTemplate(
            game.puzzle.size,
            'var(--cell-size)',
            'var(--op-size)',
            'var(--eq-size)',
            'var(--result-size)',
          ),
        }}
      >
        {Array.from({ length: game.puzzle.size * 2 + 1 }, (_, rowIndex) =>
          Array.from({ length: game.puzzle.size * 2 + 1 }, (_, colIndex) => {
            const isDataRow = rowIndex < game.puzzle.size * 2 - 1 && rowIndex % 2 === 0
            const isDataCol = colIndex < game.puzzle.size * 2 - 1 && colIndex % 2 === 0
            const isOpRow = rowIndex < game.puzzle.size * 2 - 1 && rowIndex % 2 === 1
            const isOpCol = colIndex < game.puzzle.size * 2 - 1 && colIndex % 2 === 1
            const isEqRow = rowIndex === game.puzzle.size * 2 - 1
            const isEqCol = colIndex === game.puzzle.size * 2 - 1
            const isResultRow = rowIndex === game.puzzle.size * 2
            const isResultCol = colIndex === game.puzzle.size * 2
            const row = Math.floor(rowIndex / 2)
            const col = Math.floor(colIndex / 2)

            if (isDataRow && isDataCol) {
              return (
                <button
                  key={`cell-${rowIndex}-${colIndex}`}
                  type="button"
                  className={getCellClass(game, row, col, game.selectedCell)}
                  onClick={() => onSelectCell(row, col)}
                  onKeyDown={(event) => onBoardKeyDown(event, row, col)}
                >
                  <span>{game.grid[row][col] || ''}</span>
                </button>
              )
            }

            if (isDataRow && isOpCol) {
              return (
                <div key={`row-op-${rowIndex}-${colIndex}`} className="operator-box">
                  {renderOperator(game.puzzle.rowOps[row][Math.floor(colIndex / 2)])}
                </div>
              )
            }

            if (isOpRow && isDataCol) {
              return (
                <div key={`col-op-${rowIndex}-${colIndex}`} className="operator-box">
                  {renderOperator(game.puzzle.colOps[col][Math.floor(rowIndex / 2)])}
                </div>
              )
            }

            if (isResultRow && isDataCol) {
              const state = getColumnState(game, col)
              return (
                <div key={`col-result-${col}`} className={getResultClass(state)}>
                  {game.puzzle.colResults[col]}
                </div>
              )
            }

            if (isDataRow && isResultCol) {
              const state = getRowState(game, row)
              return (
                <div key={`row-result-${row}`} className={getResultClass(state)}>
                  {game.puzzle.rowResults[row]}
                </div>
              )
            }

            if ((isEqCol && isDataRow) || (isEqRow && isDataCol)) {
              return (
                <div key={`eq-${rowIndex}-${colIndex}`} className="operator-box is-equals">
                  =
                </div>
              )
            }

            return <div key={`blank-${rowIndex}-${colIndex}`} className="board-gap" />
          }),
        )}
      </div>
    </section>
  )
}
