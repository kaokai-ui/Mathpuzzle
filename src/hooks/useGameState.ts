import { useCallback, useEffect, useRef, useState } from 'react'

import {
  applyHint,
  canPlaceNumber,
  createNewProgress,
  DIFFICULTY_CONFIGS,
  findHintTarget,
  formatDuration,
  isEditableCell,
  setCellValue,
} from '../lib/game'
import { loadProgress, saveProgress } from '../lib/storage'
import type { DifficultyKey, GameProgress } from '../lib/types'

const SAVE_THROTTLE_MS = 5000
const SAVE_DELAY_MS = 2000

export function useGameState() {
  const [game, setGame] = useState<GameProgress | null>(() => loadProgress())
  const [message, setMessage] = useState('選擇難度後開始新局，設定會自動儲存。')

  const gameRef = useRef(game)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(0)

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    saveProgress(gameRef.current)
    lastSavedRef.current = Date.now()
  }, [])

  const updateGame = useCallback(
    (next: GameProgress | null, options?: { throttleSave?: boolean }) => {
      gameRef.current = next
      setGame(next)

      if (!options?.throttleSave || Date.now() - lastSavedRef.current > SAVE_THROTTLE_MS) {
        flushSave()
        return
      }

      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(flushSave, SAVE_DELAY_MS)
      }
    },
    [flushSave],
  )

  // 分頁隱藏或關閉時立即落盤，避免節流中的計時進度遺失
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flushSave)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushSave)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [flushSave])

  const startNewGame = useCallback(
    (difficulty: DifficultyKey): boolean => {
      try {
        const next = createNewProgress(difficulty)
        updateGame(next)
        setMessage(`${DIFFICULTY_CONFIGS[difficulty].label} 新局已開始。`)
        return true
      } catch {
        setMessage('這一局產生失敗，請再試一次。')
        return false
      }
    },
    [updateGame],
  )

  const continueSavedGame = useCallback((): boolean => {
    if (!gameRef.current) {
      setMessage('目前沒有可續玩的進度。')
      return false
    }

    setMessage('已載入上次進度。')
    return true
  }, [])

  const selectCell = useCallback(
    (row: number, col: number) => {
      const current = gameRef.current
      if (!current || !isEditableCell(current, row, col)) {
        return
      }

      updateGame({
        ...current,
        selectedCell: { row, col },
        updatedAt: new Date().toISOString(),
      })
    },
    [updateGame],
  )

  const inputNumber = useCallback(
    (value: number) => {
      const current = gameRef.current
      if (!current || !current.selectedCell || current.status === 'won') {
        return
      }

      const { row, col } = current.selectedCell
      const check = canPlaceNumber(current, value, row, col)
      if (!check.allowed) {
        if (check.reason) {
          setMessage(check.reason)
        }
        return
      }

      const next = setCellValue(current, row, col, value)
      updateGame(next)

      if (next.status === 'won') {
        setMessage(`過關了，完成時間 ${formatDuration(next.elapsedSeconds)}。`)
      }
    },
    [updateGame],
  )

  const eraseCell = useCallback(() => {
    const current = gameRef.current
    if (!current || !current.selectedCell || current.status === 'won') {
      return
    }

    const { row, col } = current.selectedCell
    if (!isEditableCell(current, row, col)) {
      return
    }

    updateGame(setCellValue(current, row, col, 0))
  }, [updateGame])

  const revealHint = useCallback(() => {
    const current = gameRef.current
    if (!current || current.status === 'won') {
      return
    }

    if (current.hintsLeft <= 0) {
      setMessage('提示次數已用完。')
      return
    }

    const target = findHintTarget(current)
    if (!target) {
      setMessage('目前沒有可提示的位置。')
      return
    }

    const next = applyHint(current, target)
    updateGame(next)
    setMessage(next.status === 'won' ? '提示後完成本局。' : '已填入一格提示。')
  }, [updateGame])

  const addElapsedSeconds = useCallback(
    (delta: number) => {
      const current = gameRef.current
      if (!current || current.status === 'won') {
        return
      }

      updateGame(
        {
          ...current,
          elapsedSeconds: current.elapsedSeconds + delta,
          updatedAt: new Date().toISOString(),
        },
        { throttleSave: true },
      )
    },
    [updateGame],
  )

  const clearGame = useCallback(() => {
    updateGame(null)
  }, [updateGame])

  return {
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
    clearGame,
  }
}
