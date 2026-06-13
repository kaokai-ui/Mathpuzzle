import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { DIFFICULTY_CONFIGS } from './lib/game'
import { loadSettings, saveSettings } from './lib/storage'
import type { DifficultyKey, Settings } from './lib/types'

import { useGameState } from './hooks/useGameState'
import { useLayoutMetrics } from './hooks/useLayoutMetrics'

import { Board } from './components/Board'
import { GameHeader } from './components/GameHeader'
import { HomeScreen } from './components/HomeScreen'
import { Keypad } from './components/Keypad'
import { RulesModal } from './components/RulesModal'
import { SettingsModal } from './components/SettingsModal'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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
    useHint,
    commitBufferedDigit,
    tickTimer,
  } = useGameState()

  const { layoutMetrics, isTabletViewport } = useLayoutMetrics(game)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!game || screen !== 'game' || !settings.timerEnabled || game.status === 'won') {
      return
    }

    const timerId = window.setInterval(() => {
      tickTimer()
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [game?.status, screen, settings.timerEnabled, tickTimer])

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
    setScreen('home')
    setMessage('進度已保存在這台裝置。')
  }

  const digitBufferRef = useRef<string>('')
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushDigitBuffer = useCallback(() => {
    if (digitTimerRef.current) {
      clearTimeout(digitTimerRef.current)
      digitTimerRef.current = null
    }
    if (digitBufferRef.current) {
      commitBufferedDigit(Number(digitBufferRef.current))
      digitBufferRef.current = ''
    }
  }, [commitBufferedDigit])

  function handleBoardKeyDown(event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    if (!game) {
      return
    }

    const isHardBoard = game.puzzle.size === 4

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault()

      if (!isHardBoard) {
        if (event.key === '0') {
          eraseCell()
        } else {
          inputNumber(Number(event.key))
        }
        return
      }

      if (digitBufferRef.current && digitTimerRef.current) {
        clearTimeout(digitTimerRef.current)
        digitTimerRef.current = null
        const combined = digitBufferRef.current + event.key
        const combinedNum = Number(combined)
        digitBufferRef.current = ''
        if (combinedNum >= 10 && combinedNum <= 16) {
          commitBufferedDigit(combinedNum)
        } else {
          commitBufferedDigit(Number(combined[0]))
          if (event.key !== '0') {
            commitBufferedDigit(Number(event.key))
          }
        }
        return
      }

      if (event.key === '1' && isHardBoard) {
        digitBufferRef.current = '1'
        digitTimerRef.current = setTimeout(() => {
          digitBufferRef.current = ''
          digitTimerRef.current = null
          commitBufferedDigit(1)
        }, 900)
        return
      }

      if (event.key === '0') {
        eraseCell()
      } else {
        inputNumber(Number(event.key))
      }
      return
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      if (digitBufferRef.current) {
        digitBufferRef.current = ''
        if (digitTimerRef.current) {
          clearTimeout(digitTimerRef.current)
          digitTimerRef.current = null
        }
        return
      }
      eraseCell()
      return
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return
    }

    event.preventDefault()
    flushDigitBuffer()

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
              onSelectCell={selectCell}
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
              onInputNumber={inputNumber}
              onEraseCell={eraseCell}
              onUseHint={useHint}
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
