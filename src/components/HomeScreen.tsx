import { DIFFICULTY_CONFIGS } from '../lib/game'
import { getFilledCount, formatDuration } from '../lib/game'
import type { DifficultyKey, GameProgress, Settings } from '../lib/types'

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

interface HomeScreenProps {
  settings: Settings
  game: GameProgress | null
  message: string
  onUpdateSettings: (partial: Partial<Settings>) => void
  onStartNewGame: (difficulty?: DifficultyKey) => void
  onContinueGame: () => void
  onOpenSettings: () => void
  onOpenRules: () => void
}

export function HomeScreen({
  settings,
  game,
  message,
  onUpdateSettings,
  onStartNewGame,
  onContinueGame,
  onOpenSettings,
  onOpenRules,
}: HomeScreenProps) {
  const difficultyCards = getDifficultyCards()
  const selectedDifficulty = settings.difficulty
  const currentConfig = DIFFICULTY_CONFIGS[selectedDifficulty]
  const progressSummary = getProgressSummary(game)

  return (
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
          <button type="button" className="ghost-button" onClick={onOpenRules}>
            規則
          </button>
          <button type="button" className="ghost-button" onClick={onOpenSettings}>
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
                onClick={() => onUpdateSettings({ difficulty: card.key })}
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
            <button type="button" className="primary-button" onClick={() => onStartNewGame()}>
              開始新局
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onContinueGame}
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
  )
}
