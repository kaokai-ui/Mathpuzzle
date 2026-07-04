import { useCallback, useEffect, useMemo, useRef } from 'react'

const BUFFER_TIMEOUT_MS = 900

interface TwoDigitInputOptions {
  maxValue: number
  onCommit: (value: number) => void
}

// 處理實體鍵盤輸入兩位數（10 到 maxValue）：按下 1 之後先緩衝，
// 等第二個數字或逾時再送出。呼叫端要在選格變更等時機呼叫 flush/clearPending，
// 避免緩衝的數字寫進之後才選取的格子。
export function useTwoDigitInput({ maxValue, onCommit }: TwoDigitInputOptions) {
  const pendingRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    onCommitRef.current = onCommit
  })

  const clearPending = useCallback((): boolean => {
    const hadPending = pendingRef.current !== null
    pendingRef.current = null
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    return hadPending
  }, [])

  const flush = useCallback(() => {
    const pending = pendingRef.current
    clearPending()
    if (pending !== null) {
      onCommitRef.current(pending)
    }
  }, [clearPending])

  const pushDigit = useCallback(
    (digit: number) => {
      const pending = pendingRef.current

      if (pending !== null) {
        clearPending()
        const combined = pending * 10 + digit
        if (combined >= 10 && combined <= maxValue) {
          onCommitRef.current(combined)
        } else if (digit > 0) {
          onCommitRef.current(digit)
        } else {
          onCommitRef.current(pending)
        }
        return
      }

      if (digit === 1 && maxValue >= 10) {
        pendingRef.current = digit
        timerRef.current = setTimeout(flush, BUFFER_TIMEOUT_MS)
        return
      }

      if (digit > 0) {
        onCommitRef.current(digit)
      }
    },
    [clearPending, flush, maxValue],
  )

  const hasPending = useCallback(() => pendingRef.current !== null, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return useMemo(
    () => ({ pushDigit, flush, clearPending, hasPending }),
    [pushDigit, flush, clearPending, hasPending],
  )
}
