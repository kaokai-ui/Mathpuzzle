import { useCallback, useEffect, useRef, useState } from 'react'

import {
  applyMove,
  canPlaceNumber,
  cloneGrid,
  createNewProgress,
  DIFFICULTY_CONFIGS,
  findFirstEditableCell,
  formatDuration,
  isEditableCell,
  isPuzzleSolved,
} from '../lib/game'
import { loadProgress, saveProgress } from '../lib/storage'
import type { CellPosition, DifficultyKey, GameProgress } from '../lib/types'

function scheduleSave(data: GameProgress, immediate: boolean, timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>, lastSavedRef: React.MutableRefObject<number>) {
  if (immediate || Date.now() - lastSavedRef.current > 5000) {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    saveProgress(data)
    lastSavedRef.current = Date.now()
    return
  }

  if (!timerRef.current) {
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      saveProgress(data)
      lastSavedRef.current = Date.now()
    }, 2000)
  }
}

export function useGameState() {
  const [game, setGame] = useState<GameProgress | null>(() => loadProgress())
  const [message, setMessage] = useState('選擇難度後開始新局，設定會自動儲存。')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<number>(0)

  const persistGame = useCallback((data: GameProgress | null, immediate = false) => {
    if (!data) {
      saveProgress(null)
      return
    }

    scheduleSave(data, immediate, saveTimerRef, lastSavedRef)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  function startNewGame(difficulty: DifficultyKey) {
    try {
      const nextGame = createNewProgress(difficulty)
      setGame(nextGame)
      setMessage(`${DIFFICULTY_CONFIGS[difficulty].label} 新局已開始。`)
      persistGame(nextGame, true)
      return true
    } catch {
      setMessage('這一局產生失敗，請再試一次。')
      return false
    }
  }

  function continueSavedGame(): boolean {
    if (!game) {
      setMessage('目前沒有可續玩的進度。')
      return false
    }

    setMessage('已載入上次進度。')
    return true
  }

  function selectCell(row: number, col: number) {
    setGame((current) => {
      if (!current || !isEditableCell(current, row, col)) {
        return current
      }
      const next = {
        ...current,
        selectedCell: { row, col } as CellPosition,
        updatedAt: new Date().toISOString(),
      }
      persistGame(next, true)
      return next
    })
  }

  function inputNumber(value: number) {
    setGame((current) => {
      if (!current || !current.selectedCell || current.status === 'won') {
        return current
      }

      const { row, col } = current.selectedCell
      const check = canPlaceNumber(current, value, row, col)
      if (!check.allowed) {
        if (check.reason) {
          setMessage(check.reason)
        }
        return current
      }

      const next = applyMove(current, value, row, col)
      persistGame(next, true)

      if (next.status === 'won') {
        setMessage(`過關了，完成時間 ${formatDuration(next.elapsedSeconds)}。`)
      }

      return next
    })
  }

  function eraseCell() {
    setGame((current) => {
      if (!current || !current.selectedCell || current.status === 'won') {
        return current
      }

      const { row, col } = current.selectedCell
      if (!isEditableCell(current, row, col)) {
        return current
      }

      const nextGrid = cloneGrid(current.grid)
      nextGrid[row][col] = 0
      const nextStatus = isPuzzleSolved({ ...current, grid: nextGrid }) ? 'won' : 'playing'
      const next: GameProgress = {
        ...current,
        grid: nextGrid,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      }
      persistGame(next, true)
      return next
    })
  }

  function useHint() {
    setGame((current) => {
      if (!current || current.status === 'won') {
        return current
      }

      if (current.hintsLeft <= 0) {
        setMessage('提示次數已用完。')
        return current
      }

      let target = current.selectedCell

      if (
        !target ||
        !isEditableCell(current, target.row, target.col) ||
        current.grid[target.row][target.col] === current.puzzle.solution[target.row][target.col]
      ) {
        target = findFirstEditableCell(
          current.puzzle.given.map((row, rowIndex) =>
            row.map((isGiven, colIndex) => isGiven || current.grid[rowIndex][colIndex] === current.puzzle.solution[rowIndex][colIndex]),
          ),
        )
      }

      if (!target) {
        setMessage('目前沒有可提示的位置。')
        return current
      }

      const nextGrid = cloneGrid(current.grid)
      nextGrid[target.row][target.col] = current.puzzle.solution[target.row][target.col]
      const nextStatus = isPuzzleSolved({ ...current, grid: nextGrid }) ? 'won' : 'playing'

      const next: GameProgress = {
        ...current,
        grid: nextGrid,
        hintsLeft: current.hintsLeft - 1,
        selectedCell: target,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      }

      persistGame(next, true)
      setMessage(nextStatus === 'won' ? '提示後完成本局。' : '已填入一格提示。')
      return next
    })
  }

  function commitBufferedDigit(value: number) {
    setGame((current) => {
      if (!current || !current.selectedCell || current.status === 'won') {
        return current
      }
      const { row, col } = current.selectedCell
      const check = canPlaceNumber(current, value, row, col)
      if (!check.allowed) {
        return current
      }
      const next = applyMove(current, value, row, col)
      persistGame(next, true)
      return next
    })
  }

  function tickTimer() {
    setGame((current) => {
      if (!current || current.status === 'won') {
        return current
      }

      const next = {
        ...current,
        elapsedSeconds: current.elapsedSeconds + 1,
        updatedAt: new Date().toISOString(),
      }
      persistGame(next, false)
      return next
    })
  }

  function clearGame() {
    setGame(null)
    saveProgress(null)
  }

  return {
    game,
    setGame,
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
    clearGame,
  }
}
