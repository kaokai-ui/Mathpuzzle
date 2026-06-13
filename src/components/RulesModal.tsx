export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <span className="section-tag">Rules</span>
          <h2>遊戲規則</h2>
        </div>

        <div className="rules-copy">
          <p>把所有數字放進棋盤，讓每一列與每一行都符合右側或下方的答案。</p>
          <p>運算順序和一般數學相同，先算乘除，再算加減。</p>
          <p>每個數字只能在棋盤中出現一次，已經使用的數字會在鍵盤上自動停用。</p>
          <p>結果框會在整列或整行填滿後即時顯示正確或錯誤，方便你檢查推理。</p>
        </div>

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            我知道了
          </button>
        </div>
      </div>
    </div>
  )
}
