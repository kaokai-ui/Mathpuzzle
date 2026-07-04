import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

import { isLargeBoard } from '../lib/game'
import { clamp } from '../lib/utils'
import type { GameProgress } from '../lib/types'

const MOBILE_MAX_WIDTH = 640
const TABLET_MAX_WIDTH = 1180
const KEYPAD_EXTRA_KEYS = 2 // 清除 + 提示
const MIN_BOARD_HEIGHT = 240
const OP_TRACK_RATIO = 0.42 // 運算子軌道相對於棋盤格的寬度比例

interface LayoutProfile {
  keypadColumns: number
  keypadGap: number
  keypadPadding: number
  shellPadding: number
  headerReserve: number
  footerReserve: number
  maxContentWidth: number
  keypadButtonMin: number
  keypadButtonMax: number
  boardGap: number
  cellMin: number
  cellMax: number
}

function getLayoutProfile(viewportWidth: number, largeBoard: boolean): LayoutProfile {
  if (viewportWidth <= MOBILE_MAX_WIDTH) {
    return {
      keypadColumns: 6,
      keypadGap: largeBoard ? 6 : 8,
      keypadPadding: largeBoard ? 10 : 12,
      shellPadding: 16,
      headerReserve: largeBoard ? 196 : 188,
      footerReserve: 36,
      maxContentWidth: largeBoard ? 308 : 340,
      keypadButtonMin: largeBoard ? 36 : 42,
      keypadButtonMax: largeBoard ? 48 : 62,
      boardGap: 2,
      cellMin: largeBoard ? 22 : 28,
      cellMax: largeBoard ? 54 : 74,
    }
  }

  if (viewportWidth <= TABLET_MAX_WIDTH) {
    return {
      keypadColumns: largeBoard ? 9 : 11,
      keypadGap: 8,
      keypadPadding: 10,
      shellPadding: 48,
      headerReserve: 118,
      footerReserve: 78,
      maxContentWidth: largeBoard ? 640 : 760,
      keypadButtonMin: 34,
      keypadButtonMax: 52,
      boardGap: 4,
      cellMin: 30,
      cellMax: 92,
    }
  }

  return {
    keypadColumns: largeBoard ? 9 : 11,
    keypadGap: 10,
    keypadPadding: 14,
    shellPadding: 48,
    headerReserve: 118,
    footerReserve: 78,
    maxContentWidth: 820,
    keypadButtonMin: 44,
    keypadButtonMax: 68,
    boardGap: 4,
    cellMin: 30,
    cellMax: 92,
  }
}

function getViewport() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 }
  }

  return { width: window.innerWidth, height: window.innerHeight }
}

function computeLayoutMetrics(progress: GameProgress | null, viewport: { width: number; height: number }) {
  if (!progress) {
    return {
      gridStyle: {} as CSSProperties,
      keypadStyle: {} as CSSProperties,
    }
  }

  const size = progress.puzzle.size
  const profile = getLayoutProfile(viewport.width, isLargeBoard(progress.puzzle))

  const keypadRows =
    progress.status === 'won'
      ? 1
      : Math.ceil((progress.puzzle.numPool.length + KEYPAD_EXTRA_KEYS) / profile.keypadColumns)

  const availableWidth = Math.min(viewport.width - profile.shellPadding, profile.maxContentWidth)
  const buttonSizeByWidth =
    (availableWidth - profile.keypadPadding * 2 - profile.keypadGap * (profile.keypadColumns - 1)) /
    profile.keypadColumns
  const buttonSize = clamp(Math.floor(buttonSizeByWidth), profile.keypadButtonMin, profile.keypadButtonMax)
  const keypadHeight = profile.keypadPadding * 2 + keypadRows * buttonSize + (keypadRows - 1) * profile.keypadGap

  const boardUnits = size + 1 + (size - 1) * OP_TRACK_RATIO + OP_TRACK_RATIO
  const availableBoardHeight = viewport.height - profile.headerReserve - keypadHeight - profile.footerReserve
  const totalGap = profile.boardGap * (size * 2)
  const cellByWidth = (availableWidth - totalGap) / boardUnits
  const cellByHeight = (Math.max(availableBoardHeight, MIN_BOARD_HEIGHT) - totalGap) / boardUnits
  const cellSize = clamp(Math.floor(Math.min(cellByWidth, cellByHeight)), profile.cellMin, profile.cellMax)
  const opSize = Math.max(12, Math.floor(cellSize * OP_TRACK_RATIO))

  return {
    gridStyle: {
      '--cell-size': `${cellSize}px`,
      '--op-size': `${opSize}px`,
      '--eq-size': `${opSize}px`,
      '--result-size': `${cellSize}px`,
      '--grid-gap': `${profile.boardGap}px`,
      '--cell-font': `${Math.max(16, Math.floor(cellSize * 0.4))}px`,
      '--op-font': `${Math.max(16, Math.floor(opSize * 0.64) + 2)}px`,
      '--result-font': `${Math.max(14, Math.floor(cellSize * 0.4))}px`,
    } as CSSProperties,
    keypadStyle: {
      '--keypad-columns': String(profile.keypadColumns),
      '--keypad-gap': `${profile.keypadGap}px`,
      '--keypad-button-size': `${buttonSize}px`,
    } as CSSProperties,
  }
}

export function useLayoutMetrics(progress: GameProgress | null) {
  const [viewport, setViewport] = useState(getViewport)

  useEffect(() => {
    const onResize = () => setViewport(getViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isTabletViewport = viewport.width > MOBILE_MAX_WIDTH && viewport.width <= TABLET_MAX_WIDTH

  return {
    layoutMetrics: computeLayoutMetrics(progress, viewport),
    isTabletViewport,
  }
}
