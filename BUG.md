# 程式碼審查報告（2026-07-04）

審查範圍：`src/` 全部原始碼（App.tsx、components/、hooks/、lib/）。

> **修復狀態：全部完成（2026-07-04）**
> 所有 Bug（B1–B9）與重構項目（R1–R10）已於同日修復，驗證方式：
>
> - `npm run build`（tsc + vite）通過
> - `npm test`：30 個單元測試全數通過（vitest，新增）
> - `npm run lint`：ESLint 無任何錯誤（新增，含 react-hooks 規則）
> - 端到端驗證：headless Chrome + CDP 驅動真實 UI，18/18 步驟通過
>   （含計時精度、提示去重、兩位數輸入緩衝、存檔還原、過關流程、壞存檔復原；
>   驗證腳本保存於 `.claude/skills/verify/`）

---

## 一、Bug

### B1. ✅ 計時器每次 render 都被重設，會越走越慢（嚴重度：高）

**位置**：`src/App.tsx`、`src/hooks/useGameState.ts`

`tickTimer` 是每次 render 都重新建立的一般函式，而它被放進計時器 `useEffect` 的依賴陣列，導致 interval 每秒被砍掉重建；玩家連續操作時計時明顯偏慢。瀏覽器對背景分頁節流 `setInterval` 也會讓秒數少算。

**修復**：新增 `src/hooks/useGameTimer.ts`，改用時間戳差值計時——interval 每 250ms 檢查 `Date.now()` 與上次 tick 的差距，只在跨秒時回報增量。interval 重建或背景節流都不再影響累計秒數。E2E 驗證：閒置 3.2 秒與連續點擊 3.2 秒下，計時都前進 3 秒。

### B2. ✅ 在 `setState` updater 內執行副作用，StrictMode 下會重複觸發（嚴重度：高）

**位置**：`src/hooks/useGameState.ts` 全部 action

原本 `persistGame()`（寫 localStorage）和 `setMessage()` 都在 `setGame((current) => {...})` 的 updater 裡呼叫，違反 updater 必須是純函式的規則；專案開著 `React.StrictMode`，開發模式下會執行兩次。

**修復**：重構為 `gameRef` + `updateGame()` 模式——action 先從 ref 讀取目前狀態、純計算出 next state，再依序呼叫 `setGame(next)`、儲存、`setMessage(...)`，全部移出 updater。所有 action 以 `useCallback` 包住，身分穩定（同時是 R1）。

### B3. ✅ 玩家找到「另一組合法解」會被判錯、無法過關（嚴重度：高）

**位置**：`src/lib/game.ts`（`isPuzzleSolved`）、`src/components/Board.tsx`（`getCellClass`）

勝利判定與格子紅綠標示原本逐格比對預存解答，但同一組行列等式可能有多種合法排列，導致合法解被標紅且永遠不能過關，而行列結果框卻顯示綠色，UI 自相矛盾。

**修復**：`isPuzzleSolved` 改為「每個數字恰用一次 + 所有行列等式成立」；格子標示改以所屬行列等式狀態判定（兩條線都正確→綠、任一條完整但錯誤→紅、未填滿→不標示）。單元測試涵蓋「另一組合法解也過關」的案例（2x2 雙解謎題）。

### B4. ✅ 提示功能可造成同一數字在盤面出現兩次（嚴重度：中）

**位置**：`src/hooks/useGameState.ts`（`useHint`）

提示直接把解答值填入目標格，若玩家已把同一數字放錯在別格，盤面會出現兩個相同數字，違反遊戲規則。

**修復**：提示邏輯抽到 `src/lib/game.ts` 的 `applyHint()`，填入前先清掉盤面上其它格的相同數字；目標選擇也抽成 `findHintTarget()`。單元測試 + E2E 探測皆驗證去重行為。

### B5. ✅ 困難模式兩位數輸入緩衝：計時器過期後可能填錯格子（嚴重度：中）

**位置**：`src/App.tsx`（digit buffer）

按下 `1` 啟動 900ms 緩衝後，若玩家改用滑鼠點選其它格子或點螢幕鍵盤，逾時的 `commit` 會把 1 填進新選的格子。無效組合（如 `1`+`9`）也會連續 commit 兩次。

**修復**：緩衝邏輯抽成 `src/hooks/useTwoDigitInput.ts`；滑鼠選格時 `flush()`（把緩衝值送進原本的格子）、螢幕鍵盤操作與換局時 `clearPending()`；無效組合只 commit 第二個數字一次。E2E 探測驗證：緩衝中換格點選，1 落在原格、新格保持空白。

### B6. ✅ 延遲儲存會寫入過期快照（嚴重度：低）

**位置**：`src/hooks/useGameState.ts`（`scheduleSave`）

pending timeout 的閉包鎖住舊 state，延遲儲存會把過期的 `elapsedSeconds` 寫進 localStorage；關分頁最多丟失約 5–7 秒計時。

**修復**：延遲儲存改讀 `gameRef.current`（永遠是最新狀態）；新增 `visibilitychange`（hidden）與 `pagehide` 監聽，分頁隱藏或關閉時立即落盤。

### B7. ✅ localStorage 寫入沒有錯誤處理，且 save 系列缺少 window 防護（嚴重度：低）

**位置**：`src/lib/storage.ts`

**修復**：所有 `getItem`/`setItem`/`removeItem` 包進 `readItem`/`writeItem`/`removeItem` 輔助函式（try/catch，容量滿或隱私模式下靜默放棄）；`saveSettings`/`saveProgress` 補上與 load 系列一致的 `typeof window` 防護。

### B8. ✅ 存檔驗證有漏洞（嚴重度：低）

**位置**：`src/lib/storage.ts`（`validateProgress`）

**修復**：新增驗證——`numPool.length === size²`；解答值須為 1..n² 且不重複；盤面值須為 0..n² 的整數；`hintsLeft` 為整數且不超過該難度上限；`rowOps`/`colOps` 內層長度須為 `size - 1`。附單元測試。E2E 探測驗證壞存檔載入時 app 正常顯示主畫面且「繼續遊戲」停用。

### B9. ✅ 小問題

- `GameHeader.tsx`：移除未使用的 `DifficultyKey` import。
- `HomeScreen.tsx`：合併重複的 import 行。
- `commitBufferedDigit` 吞掉拒絕訊息：已與 `inputNumber` 合併為單一路徑，訊息行為一致。
- `getLineOptions` 的 24 筆上限造成運算子偏向 `+`、`-`：上限已移除（4x4 每線最多 64 種組合，成本可忽略），謎題多樣性恢復。

---

## 二、重構（全部完成）

### R1. ✅ `useGameState` 動作函式改為純計算 + 副作用外移

與 B2 一併完成：`gameRef` 保存最新狀態、`updateGame()` 統一處理 setState 與儲存（含節流）、所有 action 包 `useCallback`。`useHint` 更名為 `revealHint`（避免被 react-hooks lint 誤判為 hook）。

### R2. ✅ 計時器抽成獨立 hook 並改用時間戳

新增 `src/hooks/useGameTimer.ts`（見 B1）。App 端只需 `useGameTimer(timerActive, addElapsedSeconds)` 一行。

### R3. ✅ 合併重複的盤面更新邏輯

`applyMove` / `eraseCell` / `useHint` 三處重複的「clone → 寫值 → 判定 → 更新」合併為 `game.ts` 的 `setCellValue(progress, row, col, value)`（清除即傳 0）；`inputNumber` 與 `commitBufferedDigit` 合併為單一 `inputNumber`。

### R4. ✅ 消除重複的工具函式與資料轉換

- `clamp` 移到 `src/lib/utils.ts`，App 與 useLayoutMetrics 共用。
- 兩份相同的 `getDifficultyCards()` 改為 `game.ts` 匯出的靜態常數 `DIFFICULTY_CARDS`。

### R5. ✅ 消除散落的 `size === 4` 魔術判斷

新增 `game.ts` 的 `isLargeBoard(puzzle)`，Keypad 與 useLayoutMetrics 改用；App 的鍵盤輸入不再判斷難度——`useTwoDigitInput` 以 `maxValue`（= `numPool.length`）自動決定是否啟用兩位數緩衝。

### R6. ✅ 兩位數鍵盤輸入抽成 hook

新增 `src/hooks/useTwoDigitInput.ts`（見 B5），App.tsx 的 keydown 處理縮減為單純的分派邏輯，方向鍵 delta 改為查表（`ARROW_DELTAS`）。

### R7. ✅ `Board.tsx` 的格子類型判斷簡化

8 個布林旗標改為 `getTrackKind(index, size)` 回傳 `'data' | 'op' | 'eq' | 'result'`；`gridTemplateColumns/Rows` 的 track template 只計算一次共用；行列等式狀態在元件頂端各計算一次，供結果框與格子標示（B3）共用。

### R8. ✅ `useLayoutMetrics` 的魔術數字命名化

所有裸數字整理進 `getLayoutProfile(viewportWidth, largeBoard)` 回傳的具名 `LayoutProfile`（斷點、保留高度、按鍵尺寸上下限等），數值與原本完全一致；斷點常數 `MOBILE_MAX_WIDTH` / `TABLET_MAX_WIDTH` 同時供 `isTabletViewport` 使用。

### R9. ✅ `generatePuzzle` 清理

移除多餘的 `matches` 過濾——直接保留被選中的 `{ ops, result }` 配對；`getLineOptions` 的截斷上限移除（見 B9）。

### R10. ✅ 補測試與 lint 基礎建設

- **Vitest**：`npm test`，30 個測試涵蓋 `evaluateExpression`、`getLineState`、`isPuzzleSolved`（含多解案例）、`canPlaceNumber`、`applyHint`、`findHintTarget`、`generatePuzzle`（三種難度的結構與等式一致性）、`validateSettings` / `validateProgress`。
- **ESLint**：`npm run lint`，flat config（`eslint.config.js`）+ typescript-eslint + `eslint-plugin-react-hooks`（會直接攔截 B1 這類依賴問題）。
- **E2E**：`.claude/skills/verify/` 保存了 headless Chrome + CDP 的完整驗證腳本與操作說明。
