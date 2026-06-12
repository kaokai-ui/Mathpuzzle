import type { CSSProperties, KeyboardEvent } from 'react'
import { useEffect, useState } from 'react'

import {
  cloneGrid,
  createNewProgress,
  DIFFICULTY_CONFIGS,
  findFirstEditableCell,
  formatDuration,
  getColumnState,
  getFilledCount,
  getRowState,
  getUsedNumbers,
  isEditableCell,
  isPuzzleSolved,
  OPERATOR_LABELS,
} from './lib/game'
import { loadProgress, loadSettings, saveProgress, saveSettings } from './lib/storage'
import type { CellPosition, DifficultyKey, EquationState, GameProgress, Operator, Settings } from './lib/types'

function getViewport() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 }
  }

  return { width: window.innerWidth, height: window.innerHeight }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function computeLayoutMetrics(progress: GameProgress | null, viewport: { width: number; height: number }) {
  const mobile = viewport.width <= 640
  const tablet = viewport.width > 640 && viewport.width <= 1180

  if (!progress) {
    return {
      gridStyle: {} as CSSProperties,
      keypadStyle: {} as CSSProperties,
    }
  }

  const size = progress.puzzle.size
  const isHardBoard = size === 4
  const keypadCols = mobile ? 6 : isHardBoard ? 9 : 11
  const keypadRows = progress.status === 'won' ? 1 : Math.ceil((progress.puzzle.numPool.length + 2) / keypadCols)
  const keypadGap = mobile ? (isHardBoard ? 6 : 8) : tablet ? 8 : 10
  const keypadPadding = mobile ? (isHardBoard ? 10 : 12) : tablet ? 10 : 14
  const shellPadding = mobile ? 16 : 48
  const headerReserve = mobile ? (isHardBoard ? 196 : 188) : 118
  const footerReserve = mobile ? 36 : 78

  const availableWidth = Math.min(
    viewport.width - shellPadding,
    mobile ? (isHardBoard ? 308 : 340) : tablet ? (isHardBoard ? 640 : 760) : 820,
  )
  const buttonSizeByWidth =
    (availableWidth - keypadPadding * 2 - keypadGap * (keypadCols - 1)) / keypadCols
  const buttonSize = clamp(
    Math.floor(buttonSizeByWidth),
    mobile ? (isHardBoard ? 36 : 42) : tablet ? 34 : 44,
    mobile ? (isHardBoard ? 48 : 62) : tablet ? 52 : 68,
  )
  const keypadHeight = keypadPadding * 2 + keypadRows * buttonSize + (keypadRows - 1) * keypadGap
  const boardGap = mobile ? 2 : 4
  const boardUnits = size + 1 + (size - 1) * 0.42 + 0.42
  const availableBoardHeight = viewport.height - headerReserve - keypadHeight - footerReserve
  const totalGap = boardGap * (size * 2)
  const cellByWidth = (availableWidth - totalGap) / boardUnits
  const cellByHeight = (Math.max(availableBoardHeight, 240) - totalGap) / boardUnits
  const cellSize = clamp(
    Math.floor(Math.min(cellByWidth, cellByHeight)),
    mobile ? (isHardBoard ? 22 : 28) : 30,
    mobile ? (isHardBoard ? 54 : 74) : 92,
  )
  const opSize = Math.max(12, Math.floor(cellSize * 0.42))
  const eqSize = opSize
  const resultSize = cellSize

  return {
    gridStyle: {
      '--cell-size': `${cellSize}px`,
      '--op-size': `${opSize}px`,
      '--eq-size': `${eqSize}px`,
      '--result-size': `${resultSize}px`,
      '--grid-gap': `${boardGap}px`,
      '--cell-font': `${Math.max(16, Math.floor(cellSize * 0.4))}px`,
      '--op-font': `${Math.max(16, Math.floor(opSize * 0.64) + 2)}px`,
      '--result-font': `${Math.max(14, Math.floor(resultSize * 0.4))}px`,
    } as CSSProperties,
    keypadStyle: {
      '--keypad-columns': String(keypadCols),
      '--keypad-gap': `${keypadGap}px`,
      '--keypad-button-size': `${buttonSize}px`,
    } as CSSProperties,
  }
}

function getDifficultyCards() {
  return (Object.keys(DIFFICULTY_CONFIGS) as DifficultyKey[]).map((key) => ({
    key,
    ...DIFFICULTY_CONFIGS[key],
  }))
}

function getProgressSummary(progress: GameProgress | null): string {
  if (!progress) {
    return '尚未開始遊戲'
  }

  const total = progress.puzzle.size * progress.puzzle.size
  const filled = getFilledCount(progress.grid)
  return `${DIFFICULTY_CONFIGS[progress.puzzle.difficulty].label} / ${filled}/${total} 格 / ${formatDuration(
    progress.elapsedSeconds,
  )}`
}

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

function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [game, setGame] = useState<GameProgress | null>(() => loadProgress())
  const [screen, setScreen] = useState<'home' | 'game'>('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [message, setMessage] = useState('選擇難度後開始新局，設定會自動儲存。')
  const [viewport, setViewport] = useState(getViewport)

  useEffect(() => {
    const onResize = () => setViewport(getViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    saveProgress(game)
  }, [game])

  useEffect(() => {
    if (!game || screen !== 'game' || !settings.timerEnabled || game.status === 'won') {
      return
    }

    const timerId = window.setInterval(() => {
      setGame((current) => {
        if (!current || current.status === 'won') {
          return current
        }

        return {
          ...current,
          elapsedSeconds: current.elapsedSeconds + 1,
          updatedAt: new Date().toISOString(),
        }
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [game?.status, screen, settings.timerEnabled])

  const layoutMetrics = computeLayoutMetrics(game, viewport)
  const difficultyCards = getDifficultyCards()
  const selectedDifficulty = settings.difficulty
  const currentConfig = DIFFICULTY_CONFIGS[selectedDifficulty]
  const progressSummary = getProgressSummary(game)
  const usedNumbers = game ? getUsedNumbers(game.grid) : new Map<number, number>()
  const isTabletViewport = viewport.width > 640 && viewport.width <= 1180
  const keypadItems = game
    ? getKeypadItems(game.puzzle.numPool, isTabletViewport, game.puzzle.size === 4)
    : []

  function updateSettings(partial: Partial<Settings>) {
    setSettings((current) => ({
      ...current,
      ...partial,
    }))
  }

  function startNewGame(difficulty = selectedDifficulty) {
    try {
      const nextGame = createNewProgress(difficulty)
      setGame(nextGame)
      setScreen('game')
      setMessage(`${DIFFICULTY_CONFIGS[difficulty].label} 新局已開始。`)
    } catch {
      setMessage('這一局產生失敗，請再試一次。')
    }
  }

  function continueSavedGame() {
    if (!game) {
      setMessage('目前沒有可續玩的進度。')
      return
    }

    setScreen('game')
    setMessage('已載入上次進度。')
  }

  function backToHome() {
    setScreen('home')
    setMessage('進度已保存在這台裝置。')
  }

  function selectCell(row: number, col: number) {
    if (!game || !isEditableCell(game, row, col)) {
      return
    }

    setGame({
      ...game,
      selectedCell: { row, col },
      updatedAt: new Date().toISOString(),
    })
  }

  function applyGridUpdate(nextGrid: number[][], nextSelectedCell: CellPosition | null = game?.selectedCell ?? null) {
    if (!game) {
      return
    }

    const nextStatus = isPuzzleSolved({ ...game, grid: nextGrid }) ? 'won' : 'playing'
    const nextGame: GameProgress = {
      ...game,
      grid: nextGrid,
      selectedCell: nextSelectedCell,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    }

    setGame(nextGame)

    if (nextStatus === 'won') {
      setMessage(`過關了，完成時間 ${formatDuration(nextGame.elapsedSeconds)}。`)
    }
  }

  function inputNumber(value: number) {
    if (!game || !game.selectedCell || game.status === 'won') {
      return
    }

    const { row, col } = game.selectedCell
    if (!isEditableCell(game, row, col)) {
      return
    }

    const currentValue = game.grid[row][col]
    const usedCount = usedNumbers.get(value) ?? 0
    const isUnavailable = usedCount > 0 && currentValue !== value
    if (isUnavailable) {
      setMessage(`數字 ${value} 已經在棋盤上使用。`)
      return
    }

    const nextGrid = cloneGrid(game.grid)
    nextGrid[row][col] = value
    applyGridUpdate(nextGrid)
  }

  function eraseCell() {
    if (!game || !game.selectedCell || game.status === 'won') {
      return
    }

    const { row, col } = game.selectedCell
    if (!isEditableCell(game, row, col)) {
      return
    }

    const nextGrid = cloneGrid(game.grid)
    nextGrid[row][col] = 0
    applyGridUpdate(nextGrid)
  }

  function useHint() {
    if (!game || game.status === 'won') {
      return
    }

    if (game.hintsLeft <= 0) {
      setMessage('提示次數已用完。')
      return
    }

    let target = game.selectedCell

    if (
      !target ||
      !isEditableCell(game, target.row, target.col) ||
      game.grid[target.row][target.col] === game.puzzle.solution[target.row][target.col]
    ) {
      target = findFirstEditableCell(
        game.puzzle.given.map((row, rowIndex) =>
          row.map((isGiven, colIndex) => isGiven || game.grid[rowIndex][colIndex] === game.puzzle.solution[rowIndex][colIndex]),
        ),
      )
    }

    if (!target) {
      setMessage('目前沒有可提示的位置。')
      return
    }

    const nextGrid = cloneGrid(game.grid)
    nextGrid[target.row][target.col] = game.puzzle.solution[target.row][target.col]
    const nextStatus = isPuzzleSolved({ ...game, grid: nextGrid }) ? 'won' : 'playing'

    setGame({
      ...game,
      grid: nextGrid,
      hintsLeft: game.hintsLeft - 1,
      selectedCell: target,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    })

    setMessage(nextStatus === 'won' ? '提示後完成本局。' : '已填入一格提示。')
  }

  function handleBoardKeyDown(event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    if (!game) {
      return
    }

    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault()
      inputNumber(Number(event.key))
      return
    }

    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault()
      eraseCell()
      return
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return
    }

    event.preventDefault()

    const delta =
      event.key === 'ArrowUp'
        ? { row: -1, col: 0 }
        : event.key === 'ArrowDown'
          ? { row: 1, col: 0 }
          : event.key === 'ArrowLeft'
            ? { row: 0, col: -1 }
            : { row: 0, col: 1 }

    const nextRow = clamp(row + delta.row, 0, game.puzzle.size - 1)
    const nextCol = clamp(col + delta.col, 0, game.puzzle.size - 1)
    selectCell(nextRow, nextCol)
  }

  return (
    <main className="app-shell">
      <div className="backdrop-orb backdrop-orb--one" />
      <div className="backdrop-orb backdrop-orb--two" />

      {screen === 'home' || !game ? (
        <section className="home-shell">
          <header className="hero-card card-surface">
            <div className="hero-copy">
              <span className="eyebrow">Cross Platform Puzzle</span>
              <h1>Math-puzzle</h1>
              <p>
                重新整理成 Vite + React + TypeScript，支援 PC、iPad 與 Android Pad，
                並且會自動保存你的設定與遊戲進度。
              </p>
            </div>

            <div className="hero-actions">
              <button type="button" className="ghost-button" onClick={() => setRulesOpen(true)}>
                規則
              </button>
              <button type="button" className="ghost-button" onClick={() => setSettingsOpen(true)}>
                設定
              </button>
            </div>
          </header>

          <section className="home-grid">
            <article className="selection-card card-surface">
              <div className="section-heading">
                <span className="section-tag">Step 1</span>
                <h2>選擇難度</h2>
              </div>

              <div className="difficulty-grid">
                {difficultyCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    className={`difficulty-card ${selectedDifficulty === card.key ? 'is-active' : ''}`}
                    onClick={() => updateSettings({ difficulty: card.key })}
                  >
                    <strong>{card.label}</strong>
                    <span>{card.description}</span>
                    <small>
                      {card.size}x{card.size} / 提示 {card.hints} 次 / 預填 {card.prefilled} 格
                    </small>
                  </button>
                ))}
              </div>
            </article>

            <article className="summary-card card-surface">
              <div className="section-heading">
                <span className="section-tag">Step 2</span>
                <h2>開始或續玩</h2>
              </div>

              <div className="summary-stack">
                <div className="summary-pill">
                  <span>目前選擇</span>
                  <strong>{currentConfig.label}</strong>
                </div>
                <div className="summary-pill">
                  <span>計時功能</span>
                  <strong>{settings.timerEnabled ? '開啟' : '關閉'}</strong>
                </div>
                <div className="summary-pill">
                  <span>已保存進度</span>
                  <strong>{progressSummary}</strong>
                </div>
              </div>

              <div className="cta-group">
                <button type="button" className="primary-button" onClick={() => startNewGame()}>
                  開始新局
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={continueSavedGame}
                  disabled={!game}
                >
                  {game ? '繼續遊戲' : '沒有可續玩的進度'}
                </button>
              </div>
            </article>
          </section>

          <footer className="status-line">
            <span>{message}</span>
            <span>設定與進度都會保存到 localStorage。</span>
          </footer>
        </section>
      ) : (
        <section className="game-shell">
          <header className="game-header card-surface">
            <div className="toolbar-row toolbar-row--top">
              <button type="button" className="toolbar-button" onClick={backToHome}>
                主畫面
              </button>
              <button type="button" className="toolbar-button" onClick={() => startNewGame(game.puzzle.difficulty)}>
                重開
              </button>
              <button type="button" className="toolbar-button" onClick={() => setSettingsOpen(true)}>
                設定
              </button>
            </div>

            <div className="game-title-block">
              <div className="game-title-row">
              <span className="eyebrow">Now Playing</span>
              <h2>{DIFFICULTY_CONFIGS[game.puzzle.difficulty].label}</h2>
                <p className="game-note">{message}</p>
              </div>
            </div>

            <div className="stat-row">
              <div className="stat-chip">
                <span>提示</span>
                <strong>{game.hintsLeft}</strong>
              </div>
              <div className="stat-chip">
                <span>時間</span>
                <strong>{settings.timerEnabled ? formatDuration(game.elapsedSeconds) : '已關閉'}</strong>
              </div>
              <div className="stat-chip">
                <span>狀態</span>
                <strong>{game.status === 'won' ? '完成' : '進行中'}</strong>
              </div>
            </div>
          </header>

          <div className="board-stage">
            <section className="board-card card-surface">
              <div
                className="math-puzzle-board"
                style={{
                  ...layoutMetrics.gridStyle,
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
                          onClick={() => selectCell(row, col)}
                          onKeyDown={(event) => handleBoardKeyDown(event, row, col)}
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
          </div>

          <section className="keypad-card card-surface" style={layoutMetrics.keypadStyle}>
            {game.status === 'won' ? (
              <div className="win-panel">
                <p className="win-panel__message">這一關完成了，可以直接開始下一關。</p>
                <button
                  type="button"
                  className="primary-button win-action-button"
                  onClick={() => startNewGame(game.puzzle.difficulty)}
                >
                  下一關
                </button>
              </div>
            ) : (
              <div className="keypad-grid">
                {keypadItems.map((item) => {
                  if (item.type === 'number') {
                    const value = item.value
                    const currentValue = game.selectedCell
                      ? game.grid[game.selectedCell.row][game.selectedCell.col]
                      : 0
                    const usedCount = usedNumbers.get(value) ?? 0
                    const disabled = usedCount > 0 && currentValue !== value

                    return (
                      <button
                        key={value}
                        type="button"
                        className={`keypad-button ${currentValue === value ? 'is-active' : ''}`}
                        onClick={() => inputNumber(value)}
                        disabled={disabled}
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
                        onClick={eraseCell}
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
                      onClick={useHint}
                      disabled={game.hintsLeft <= 0}
                    >
                      提示
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <div className="toolbar-row toolbar-row--bottom card-surface">
            <button type="button" className="toolbar-button" onClick={backToHome}>
              主畫面
            </button>
            <button type="button" className="toolbar-button" onClick={() => startNewGame(game.puzzle.difficulty)}>
              重開
            </button>
            <button type="button" className="toolbar-button" onClick={() => setSettingsOpen(true)}>
              設定
            </button>
          </div>

        </section>
      )}

      {settingsOpen ? (
        <div className="modal-scrim" onClick={() => setSettingsOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading">
              <span className="section-tag">Settings</span>
              <h2>遊戲設定</h2>
            </div>

            <label className="toggle-row">
              <div>
                <strong>啟用計時</strong>
                <p>關閉後不會繼續累加時間，但仍會保留已經記錄的秒數。</p>
              </div>
              <input
                type="checkbox"
                checked={settings.timerEnabled}
                onChange={(event) => updateSettings({ timerEnabled: event.target.checked })}
              />
            </label>

            <label className="toggle-row">
              <div>
                <strong>預設難度</strong>
                <p>主畫面會記住你上次選擇的難度。</p>
              </div>
              <select
                value={settings.difficulty}
                onChange={(event) => updateSettings({ difficulty: event.target.value as DifficultyKey })}
              >
                {difficultyCards.map((card) => (
                  <option key={card.key} value={card.key}>
                    {card.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => setSettingsOpen(false)}>
                完成
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rulesOpen ? (
        <div className="modal-scrim" onClick={() => setRulesOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading">
              <span className="section-tag">Rules</span>
              <h2>遊戲規則</h2>
            </div>

            <div className="rules-copy">
              <p>把所有數字放進棋盤，讓每一列與每一行都符合右側或下方的答案。</p>
              <p>運算順序和一般數學相同，先算乘除，再算加減。</p>
              <p>每個數字只能在棋盤中出現一次，已經使用的數字會在鍵盤上自動停用。</p>
              <p>結果框會在整列或整行填滿後即時顯示正確或錯誤，方便你檢查推理。</p>
            </div>

            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => setRulesOpen(false)}>
                我知道了
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
