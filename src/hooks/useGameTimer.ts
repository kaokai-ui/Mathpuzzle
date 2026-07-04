import { useEffect, useRef } from 'react'

const TICK_INTERVAL_MS = 250

// 以時間戳差值計時，而不是每秒累加：
// 1. interval 被重建或瀏覽器對背景分頁節流時，經過的秒數仍然正確
// 2. onElapsed 走 ref，呼叫端不需要提供 stable callback
export function useGameTimer(active: boolean, onElapsed: (deltaSeconds: number) => void) {
  const onElapsedRef = useRef(onElapsed)

  useEffect(() => {
    onElapsedRef.current = onElapsed
  })

  useEffect(() => {
    if (!active) {
      return
    }

    let lastTick = Date.now()
    const timerId = window.setInterval(() => {
      const deltaSeconds = Math.floor((Date.now() - lastTick) / 1000)
      if (deltaSeconds > 0) {
        lastTick += deltaSeconds * 1000
        onElapsedRef.current(deltaSeconds)
      }
    }, TICK_INTERVAL_MS)

    return () => window.clearInterval(timerId)
  }, [active])
}
