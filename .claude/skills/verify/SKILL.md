---
name: verify
description: End-to-end verification recipe for the Mathpuzzle app — build, serve with vite preview, drive the real UI in headless Chrome via CDP.
---

# Verify Mathpuzzle

## Build & serve

```bash
npm run build                                # tsc -b && vite build
npm run preview -- --port 4300 --strictPort  # serves dist/ (background)
```

## Drive the UI (no Playwright needed)

Node 24+ has a built-in WebSocket client, and headless Chrome exposes CDP.
`verify.mjs` in this directory drives the full app end-to-end:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new \
  --remote-debugging-port=9333 --user-data-dir=<scratch>/chrome-profile \
  --no-first-run --window-size=1280,900 about:blank   # background

node .claude/skills/verify/verify.mjs <screenshot-dir>
```

It exits 0 with `18/18 steps passed` and drops numbered screenshots in
`<screenshot-dir>`. Covered flows: home render, start easy game, keyboard
input, keypad disable, erase, timer pacing (idle + under interaction), hint
(incl. duplicate cleanup), reload persistence, full solve → win panel, hard
mode two-digit input (`1`+`2` combo, lone `1` timeout, Backspace cancel,
flush-on-reselect), corrupted-save recovery.

## Gotchas

- **State injection must beat the app's autosave.** The app flushes progress
  to localStorage on `pagehide`, so `localStorage.setItem(...)` followed by a
  reload gets overwritten. Use `Page.addScriptToEvaluateOnNewDocument` to
  seed/corrupt/clear storage on the *new* document instead.
- **Register `Page.loadEventFired` waiters before sending `Page.navigate`**,
  or the event can fire before the waiter exists and everything misaligns.
- **Puzzles are random.** Any step that needs a specific number free (e.g.
  the two-digit probes need `1` unused) must check the saved progress
  (`localStorage['math-puzzle-progress']`) and click 重開 until satisfied.
- Keyboard events reach React via
  `cell.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))`.
- Unit tests (`npm test`) cover `src/lib/` pure logic; ESLint via `npm run lint`.
