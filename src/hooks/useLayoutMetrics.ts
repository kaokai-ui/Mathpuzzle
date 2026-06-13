import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import type { GameProgress } from '../lib/types'

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

export function useLayoutMetrics(progress: GameProgress | null) {
  const [viewport, setViewport] = useState(getViewport)

  useEffect(() => {
    const onResize = () => setViewport(getViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isTabletViewport = viewport.width > 640 && viewport.width <= 1180

  return {
    layoutMetrics: computeLayoutMetrics(progress, viewport),
    isTabletViewport,
  }
}
