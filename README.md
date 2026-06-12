# Math-puzzle

一個以 `Vite + React + TypeScript` 製作的數學益智遊戲，支援 `PC`、`iPad` 與 `Android Pad`，並會把設定與遊戲進度存到 `localStorage`。

## 特色

- 主畫面可先選難度，再進入遊戲
- 支援簡單 / 普通 / 困難關卡
- 設定會自動儲存到 `localStorage`
- 遊戲進度會自動儲存到 `localStorage`
- 計時功能可在設定中開啟或關閉
- 過關後可直接進入下一關
- 棋盤與數字鍵盤已針對手機、平板、桌機調整版面

## 技術

- Vite
- React 19
- TypeScript

## 本機開發

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
npm run preview
```

建置完成的靜態檔會輸出到 `dist/`。

## 專案結構

```text
src/
  assets/         圖像素材
  lib/            遊戲邏輯、型別、localStorage 存取
  App.tsx         主畫面、遊戲畫面、設定流程
public/
  icons/          App icon 與 favicon
tmp/              截圖、log、暫存檔
```

## 備註

- `Docs/` 已加入 `.gitignore`
- `tmp/` 用來集中存放開發過程的截圖與 log，不會進版控
