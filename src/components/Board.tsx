import type { CSSProperties, KeyboardEvent } from 'react'

import { getColumnState, getRowState, OPERATOR_LABELS } from '../lib/game'
import type { EquationState, GameProgress } from '../lib/types'

type TrackKind = 'data' | 'op' | 'eq' | 'result'

function getTrackKind(index: number, size: number): TrackKind {
  if (index === size * 2 - 1) {
    return 'eq'
  }

  if (index === size * 2) {
    return 'result'
  }

  return index % 2 === 0 ? 'data' : 'op'
}

// 格子的對錯以所屬行列等式的狀態判定（等式全部成立才算對），
// 不與預存解答逐格比對，因為同一組等式可能有多種合法排列。
function getCellClass(
  progress: GameProgress,
  row: number,
  col: number,
  rowStates: EquationState[],
  colStates: EquationState[],
): string {
  const classes = ['board-cell']
  const isGiven = progress.puzzle.given[row][col]

  classes.push(isGiven ? 'is-given' : 'is-editable')

  if (progress.selectedCell?.row === row && progress.selectedCell?.col === col) {
    classes.push('is-selected')
  }

  const value = progress.grid[row][col]
  if (value && !isGiven) {
    if (rowStates[row] === 'wrong' || colStates[col] === 'wrong') {
      classes.push('is-wrong')
    } else if (rowStates[row] === 'correct' && colStates[col] === 'correct') {
      classes.push('is-correct')
    }
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

function buildBoardTrackTemplate(size: number): string {
  const tracks: string[] = []

  for (let index = 0; index < size; index += 1) {
    tracks.push('var(--cell-size)')
    if (index < size - 1) {
      tracks.push('var(--op-size)')
    }
  }

  tracks.push('var(--eq-size)', 'var(--result-size)')
  return tracks.join(' ')
}

interface BoardProps {
  game: GameProgress
  gridStyle: CSSProperties
  onSelectCell: (row: number, col: number) => void
  onBoardKeyDown: (event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) => void
}

export function Board({ game, gridStyle, onSelectCell, onBoardKeyDown }: BoardProps) {
  const size = game.puzzle.size
  const rowStates = Array.from({ length: size }, (_, row) => getRowState(game, row))
  const colStates = Array.from({ length: size }, (_, col) => getColumnState(game, col))
  const trackTemplate = buildBoardTrackTemplate(size)

  return (
    <section className="board-card card-surface">
      <div
        className="math-puzzle-board"
        style={{
          ...gridStyle,
          gridTemplateColumns: trackTemplate,
          gridTemplateRows: trackTemplate,
        }}
      >
        {Array.from({ length: size * 2 + 1 }, (_, rowIndex) =>
          Array.from({ length: size * 2 + 1 }, (_, colIndex) => {
            const rowKind = getTrackKind(rowIndex, size)
            const colKind = getTrackKind(colIndex, size)
            const row = Math.floor(rowIndex / 2)
            const col = Math.floor(colIndex / 2)

            if (rowKind === 'data' && colKind === 'data') {
              return (
                <button
                  key={`cell-${rowIndex}-${colIndex}`}
                  type="button"
                  className={getCellClass(game, row, col, rowStates, colStates)}
                  onClick={() => onSelectCell(row, col)}
                  onKeyDown={(event) => onBoardKeyDown(event, row, col)}
                >
                  <span>{game.grid[row][col] || ''}</span>
                </button>
              )
            }

            if (rowKind === 'data' && colKind === 'op') {
              return (
                <div key={`row-op-${rowIndex}-${colIndex}`} className="operator-box">
                  {OPERATOR_LABELS[game.puzzle.rowOps[row][col]]}
                </div>
              )
            }

            if (rowKind === 'op' && colKind === 'data') {
              return (
                <div key={`col-op-${rowIndex}-${colIndex}`} className="operator-box">
                  {OPERATOR_LABELS[game.puzzle.colOps[col][row]]}
                </div>
              )
            }

            if (rowKind === 'result' && colKind === 'data') {
              return (
                <div key={`col-result-${col}`} className={getResultClass(colStates[col])}>
                  {game.puzzle.colResults[col]}
                </div>
              )
            }

            if (rowKind === 'data' && colKind === 'result') {
              return (
                <div key={`row-result-${row}`} className={getResultClass(rowStates[row])}>
                  {game.puzzle.rowResults[row]}
                </div>
              )
            }

            if ((rowKind === 'data' && colKind === 'eq') || (rowKind === 'eq' && colKind === 'data')) {
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
