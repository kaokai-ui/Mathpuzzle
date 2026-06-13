import { DIFFICULTY_CONFIGS } from '../lib/game'
import type { DifficultyKey, Settings } from '../lib/types'

function getDifficultyCards() {
  return (Object.keys(DIFFICULTY_CONFIGS) as DifficultyKey[]).map((key) => ({
    key,
    ...DIFFICULTY_CONFIGS[key],
  }))
}

interface SettingsModalProps {
  settings: Settings
  onUpdateSettings: (partial: Partial<Settings>) => void
  onClose: () => void
}

export function SettingsModal({ settings, onUpdateSettings, onClose }: SettingsModalProps) {
  const difficultyCards = getDifficultyCards()

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <span className="section-tag">Settings</span>
          <h2>遊戲設定</h2>
        </div>

        <label className="toggle-row">
          <div>
            <strong>啟用計時</strong>
            <p>關閉後不會繼續累加時間，但仍會保留已經記錄的秒數。</p>
          </div>
          <input
            type="checkbox"
            checked={settings.timerEnabled}
            onChange={(event) => onUpdateSettings({ timerEnabled: event.target.checked })}
          />
        </label>

        <label className="toggle-row">
          <div>
            <strong>預設難度</strong>
            <p>主畫面會記住你上次選擇的難度。</p>
          </div>
          <select
            value={settings.difficulty}
            onChange={(event) => onUpdateSettings({ difficulty: event.target.value as DifficultyKey })}
          >
            {difficultyCards.map((card) => (
              <option key={card.key} value={card.key}>
                {card.label}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
