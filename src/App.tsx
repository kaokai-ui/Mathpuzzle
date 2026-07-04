import type { KeyboardEvent } from 'react'
import { useEffect, useState } from 'react'

import { loadSettings, saveSettings } from './lib/storage'
import { clamp } from './lib/utils'
import type { Settings } from './lib/types'

import { useGameState } from './hooks/useGameState'
import { useGameTimer } from './hooks/useGameTimer'
import { useLayoutMetrics } from './hooks/useLayoutMetrics'
import { useTwoDigitInput } from './hooks/useTwoDigitInput'

import { Board } from './components/Board'
import { GameHeader } from './components/GameHeader'
import { HomeScreen } from './components/HomeScreen'
import { Keypad } from './components/Keypad'
import { RulesModal } from './components/RulesModal'
import { SettingsModal } from './components/SettingsModal'

const ARROW_DELTAS: Record<string, { row: number; col: number }> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
}

function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [screen, setScreen] = useState<'home' | 'game'>('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)

  const {
    game,
    message,
    setMessage,
    startNewGame,
    continueSavedGame,
    selectCell,
    inputNumber,
    eraseCell,
    revealHint,
    addElapsedSeconds,
  } = useGameState()

  const { layoutMetrics, isTabletViewport } = useLayoutMetrics(game)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const timerActive = screen === 'game' && !!game && game.status !== 'won' && settings.timerEnabled
  useGameTimer(timerActive, addElapsedSeconds)

  const digitInput = useTwoDigitInput({
    maxValue: game?.puzzle.numPool.length ?? 9,
    onCommit: inputNumber,
  })

  const puzzleId = game?.puzzle.id ?? null
  const { clearPending: clearPendingDigit } = digitInput

  useEffect(() => {
    clearPendingDigit()
  }, [puzzleId, clearPendingDigit])

  function updateSettings(partial: Partial<Settings>) {
    setSettings((current) => ({
      ...current,
      ...partial,
    }))
  }

  function handleStartNewGame(difficulty = settings.difficulty) {
    const ok = startNewGame(difficulty)
    if (ok) {
      setScreen('game')
    }
  }

  function handleContinueGame() {
    const ok = continueSavedGame()
    if (ok) {
      setScreen('game')
    }
  }

  function backToHome() {
    digitInput.clearPending()
    setScreen('home')
    setMessage('進度已保存在這台裝置。')
  }

  function handleSelectCell(row: number, col: number) {
    digitInput.flush()
    selectCell(row, col)
  }

  function handleInputNumber(value: number) {
    digitInput.clearPending()
    inputNumber(value)
  }

  function handleEraseCell() {
    digitInput.clearPending()
    eraseCell()
  }

  function handleRevealHint() {
    digitInput.clearPending()
    revealHint()
  }

  function handleBoardKeyDown(event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    if (!game) {
      return
    }

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault()
      const digit = Number(event.key)
      if (digit === 0 && !digitInput.hasPending()) {
        eraseCell()
        return
      }
      digitInput.pushDigit(digit)
      return
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      if (digitInput.clearPending()) {
        return
      }
      eraseCell()
      return
    }

    const delta = ARROW_DELTAS[event.key]
    if (!delta) {
      return
    }

    event.preventDefault()
    digitInput.flush()
    selectCell(
      clamp(row + delta.row, 0, game.puzzle.size - 1),
      clamp(col + delta.col, 0, game.puzzle.size - 1),
    )
  }

  return (
    <main className="app-shell">
      <div className="backdrop-orb backdrop-orb--one" />
      <div className="backdrop-orb backdrop-orb--two" />

      {screen === 'home' || !game ? (
        <HomeScreen
          settings={settings}
          game={game}
          message={message}
          onUpdateSettings={updateSettings}
          onStartNewGame={handleStartNewGame}
          onContinueGame={handleContinueGame}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenRules={() => setRulesOpen(true)}
        />
      ) : (
        <section className="game-shell">
          <GameHeader
            game={game}
            settings={settings}
            message={message}
            onBackToHome={backToHome}
            onRestart={() => handleStartNewGame(game.puzzle.difficulty)}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <div className="board-stage">
            <Board
              game={game}
              gridStyle={layoutMetrics.gridStyle}
              onSelectCell={handleSelectCell}
              onBoardKeyDown={handleBoardKeyDown}
            />
          </div>

          {game.status === 'won' ? (
            <section className="keypad-card card-surface" style={layoutMetrics.keypadStyle}>
              <div className="win-panel">
                <p className="win-panel__message">這一關完成了，可以直接開始下一關。</p>
                <button
                  type="button"
                  className="primary-button win-action-button"
                  onClick={() => handleStartNewGame(game.puzzle.difficulty)}
                >
                  下一關
                </button>
              </div>
            </section>
          ) : (
            <Keypad
              game={game}
              keypadStyle={layoutMetrics.keypadStyle}
              isTabletViewport={isTabletViewport}
              onInputNumber={handleInputNumber}
              onEraseCell={handleEraseCell}
              onUseHint={handleRevealHint}
            />
          )}

          <div className="toolbar-row toolbar-row--bottom card-surface">
            <button type="button" className="toolbar-button" onClick={backToHome}>
              主畫面
            </button>
            <button type="button" className="toolbar-button" onClick={() => handleStartNewGame(game.puzzle.difficulty)}>
              重開
            </button>
            <button type="button" className="toolbar-button" onClick={() => setSettingsOpen(true)}>
              設定
            </button>
          </div>

        </section>
      )}

      {settingsOpen ? (
        <SettingsModal
          settings={settings}
          onUpdateSettings={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {rulesOpen ? (
        <RulesModal onClose={() => setRulesOpen(false)} />
      ) : null}
    </main>
  )
}

export default App
