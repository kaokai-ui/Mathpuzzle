import { DIFFICULTY_CONFIGS, formatDuration } from '../lib/game'
import type { GameProgress, Settings } from '../lib/types'

interface GameHeaderProps {
  game: GameProgress
  settings: Settings
  message: string
  onBackToHome: () => void
  onRestart: () => void
  onOpenSettings: () => void
}

export function GameHeader({
  game,
  settings,
  message,
  onBackToHome,
  onRestart,
  onOpenSettings,
}: GameHeaderProps) {
  return (
    <header className="game-header card-surface">
      <div className="toolbar-row toolbar-row--top">
        <button type="button" className="toolbar-button" onClick={onBackToHome}>
          主畫面
        </button>
        <button type="button" className="toolbar-button" onClick={onRestart}>
          重開
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenSettings}>
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
  )
}
