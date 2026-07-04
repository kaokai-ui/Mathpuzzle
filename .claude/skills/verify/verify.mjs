// End-to-end verification of Mathpuzzle via Chrome DevTools Protocol.
// Drives the real UI served by `vite preview` in headless Chrome.
import { writeFileSync } from 'node:fs'

const CDP_PORT = 9333
const APP_URL = 'http://127.0.0.1:4300/'
const SHOT_DIR = process.argv[2] ?? '.'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.eventWaiters = []
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== undefined) {
        const { resolve, reject } = this.pending.get(msg.id) ?? {}
        this.pending.delete(msg.id)
        if (msg.error) reject?.(new Error(msg.error.message))
        else resolve?.(msg.result)
      } else if (msg.method) {
        this.eventWaiters = this.eventWaiters.filter((w) => {
          if (w.method === msg.method) {
            w.resolve(msg.params)
            return false
          }
          return true
        })
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  waitEvent(method, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting ${method}`)), timeoutMs)
      this.eventWaiters.push({ method, resolve: (p) => { clearTimeout(timer); resolve(p) } })
    })
  }
}

async function connect() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`)
  const targets = await res.json()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  return new CDP(ws)
}

const HELPERS = `
window.__h = {
  clickButton(text) {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
      ?? [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text))
    if (!btn) throw new Error('button not found: ' + text)
    btn.click()
    return true
  },
  cells() {
    return [...document.querySelectorAll('.board-cell')].map((c) => ({
      text: c.textContent.trim(),
      editable: c.classList.contains('is-editable'),
      selected: c.classList.contains('is-selected'),
      wrong: c.classList.contains('is-wrong'),
      correct: c.classList.contains('is-correct'),
    }))
  },
  clickCell(index) {
    document.querySelectorAll('.board-cell')[index].click()
    return true
  },
  keyOnCell(index, key) {
    const cell = document.querySelectorAll('.board-cell')[index]
    cell.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    return true
  },
  clickKeypad(value) {
    const btn = [...document.querySelectorAll('.keypad-button')].find(
      (b) => !b.classList.contains('is-tool') && b.textContent.trim() === String(value),
    )
    if (!btn) throw new Error('keypad button not found: ' + value)
    if (btn.disabled) return 'disabled'
    btn.click()
    return true
  },
  keypadState() {
    return [...document.querySelectorAll('.keypad-button')].map((b) => ({
      text: b.textContent.trim(),
      disabled: b.disabled,
    }))
  },
  timerText() {
    const chips = [...document.querySelectorAll('.stat-chip')]
    const chip = chips.find((c) => c.textContent.includes('時間'))
    return chip ? chip.querySelector('strong').textContent.trim() : null
  },
  message() {
    return document.querySelector('.game-note')?.textContent.trim()
      ?? document.querySelector('.status-line span')?.textContent.trim() ?? null
  },
  progress() {
    return JSON.parse(localStorage.getItem('math-puzzle-progress'))
  },
  hasWinPanel() {
    return Boolean(document.querySelector('.win-panel'))
  },
}
true
`

async function main() {
  const cdp = await connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  const evalJS = async (expression) => {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (exceptionDetails) throw new Error('page error: ' + JSON.stringify(exceptionDetails.exception?.description ?? exceptionDetails.text))
    return result.value
  }

  const shot = async (name) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(data, 'base64'))
  }

  const steps = []
  const step = (name, ok, detail = '') => {
    steps.push({ name, ok, detail })
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  }

  const navigate = async () => {
    const loaded = cdp.waitEvent('Page.loadEventFired')
    await cdp.send('Page.navigate', { url: APP_URL })
    await loaded
    await sleep(400)
    await evalJS(HELPERS)
  }

  // Fresh start: wipe storage from a clean document so no app autosave rewrites it
  const { identifier: wipeId } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'localStorage.clear()',
  })
  await navigate()
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: wipeId })
  await navigate()

  // --- Step 1: home screen renders ---
  const heroText = await evalJS(`document.querySelector('h1')?.textContent`)
  step('home renders', heroText === 'Math-puzzle', `h1=${heroText}`)
  await shot('01-home')

  // --- Step 2: start easy game ---
  await evalJS(`[...document.querySelectorAll('.difficulty-card')].find((c) => c.textContent.includes('簡單')).click()`)
  await sleep(150)
  await evalJS(`__h.clickButton('開始新局')`)
  await sleep(300)
  let cells = await evalJS('__h.cells()')
  step('easy game board 3x3', cells.length === 9, `cells=${cells.length}`)
  const givenCount = cells.filter((c) => !c.editable).length
  step('easy prefilled = 4', givenCount === 4, `given=${givenCount}`)

  // --- Step 3: keyboard input on a cell ---
  const progress = await evalJS('__h.progress()')
  const grid = progress.grid
  const solution = progress.puzzle.solution
  const size = progress.puzzle.size
  const usedValues = new Set(grid.flat().filter(Boolean))
  const firstEditable = cells.findIndex((c) => c.editable)
  const freeValue = [...Array(9).keys()].map((i) => i + 1).find((v) => !usedValues.has(v))
  await evalJS(`__h.clickCell(${firstEditable})`)
  await evalJS(`__h.keyOnCell(${firstEditable}, '${freeValue}')`)
  await sleep(200)
  cells = await evalJS('__h.cells()')
  step('keyboard digit fills cell', cells[firstEditable].text === String(freeValue), `cell=${cells[firstEditable].text}`)

  // keypad disables the used number
  let keypad = await evalJS('__h.keypadState()')
  const usedKey = keypad.find((k) => k.text === String(freeValue))
  step('keypad disables used number', usedKey?.disabled === true)

  // --- Step 4: erase via keypad ---
  await evalJS(`__h.clickButton('清除')`)
  await sleep(150)
  cells = await evalJS('__h.cells()')
  step('erase clears cell', cells[firstEditable].text === '')

  // --- Step 5: timer advances in real time ---
  const t0 = await evalJS('__h.timerText()')
  await sleep(3200)
  const t1 = await evalJS('__h.timerText()')
  const toSec = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  const elapsed = toSec(t1) - toSec(t0)
  step('timer advances ~3s over 3.2s', elapsed >= 2 && elapsed <= 4, `${t0} -> ${t1}`)

  // --- Step 6: timer keeps pace under constant interaction (old bug: interval reset) ---
  const t2 = await evalJS('__h.timerText()')
  const interactUntil = Date.now() + 3200
  while (Date.now() < interactUntil) {
    await evalJS(`__h.clickCell(${firstEditable})`)
    await sleep(120)
  }
  const t3 = await evalJS('__h.timerText()')
  const elapsed2 = toSec(t3) - toSec(t2)
  step('timer unaffected by interaction', elapsed2 >= 2 && elapsed2 <= 4, `${t2} -> ${t3}`)

  // --- Step 7: hint fills a correct cell ---
  await evalJS(`__h.clickButton('提示')`)
  await sleep(200)
  const afterHint = await evalJS('__h.progress()')
  const hintOk = afterHint.hintsLeft === progress.hintsLeft - 1
  step('hint consumes one and fills a cell', hintOk, `hintsLeft=${afterHint.hintsLeft}`)

  // --- Step 8 (probe): hint removes a misplaced duplicate ---
  // Place solution value of an empty cell into ANOTHER empty cell (wrong spot), then hint.
  {
    const p = await evalJS('__h.progress()')
    const empties = []
    for (let r = 0; r < size; r += 1)
      for (let c = 0; c < size; c += 1)
        if (!p.puzzle.given[r][c] && p.grid[r][c] === 0) empties.push([r, c])
    if (empties.length >= 2) {
      const [tr, tc] = empties[0] // hint target (first editable incorrect cell)
      const wrongSpot = empties.find(([r, c]) => p.puzzle.solution[r][c] !== p.puzzle.solution[tr][tc] && (r !== tr || c !== tc))
      const dupValue = p.puzzle.solution[tr][tc]
      const wrongIndex = wrongSpot[0] * size + wrongSpot[1]
      await evalJS(`__h.clickCell(${wrongIndex})`)
      await evalJS(`__h.clickKeypad(${dupValue})`)
      await sleep(150)
      await evalJS(`__h.clickCell(${tr * size + tc})`)
      await evalJS(`__h.clickButton('提示')`)
      await sleep(200)
      const after = await evalJS('__h.progress()')
      const count = after.grid.flat().filter((v) => v === dupValue).length
      step('PROBE hint clears misplaced duplicate', count === 1 && after.grid[tr][tc] === dupValue, `value=${dupValue} count=${count}`)
    }
  }

  // --- Step 9: reload persists progress ---
  const beforeReload = await evalJS('__h.progress()')
  await navigate()
  const summary = await evalJS(`document.querySelector('.summary-pill:last-child strong')?.textContent`)
  await evalJS(`__h.clickButton('繼續遊戲')`)
  await sleep(300)
  const afterReload = await evalJS('__h.progress()')
  step('progress survives reload', JSON.stringify(afterReload.grid) === JSON.stringify(beforeReload.grid), `summary=${summary}`)
  await shot('02-easy-restored')

  // --- Step 10: fill full solution via keypad -> win ---
  {
    const p = await evalJS('__h.progress()')
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (p.puzzle.given[r][c]) continue
        const idx = r * size + c
        const want = p.puzzle.solution[r][c]
        await evalJS(`__h.clickCell(${idx})`)
        const cur = (await evalJS('__h.progress()')).grid[r][c]
        if (cur === want) continue
        if (cur !== 0) {
          await evalJS(`__h.clickButton('清除')`)
          await sleep(80)
        }
        const res = await evalJS(`__h.clickKeypad(${want})`)
        if (res === 'disabled') {
          // value stuck in another wrong cell: find and erase it first
          const q = await evalJS('__h.progress()')
          for (let rr = 0; rr < size; rr += 1)
            for (let cc = 0; cc < size; cc += 1)
              if (q.grid[rr][cc] === want && !q.puzzle.given[rr][cc] && (rr !== r || cc !== c)) {
                await evalJS(`__h.clickCell(${rr * size + cc})`)
                await evalJS(`__h.clickButton('清除')`)
              }
          await evalJS(`__h.clickCell(${idx})`)
          await evalJS(`__h.clickKeypad(${want})`)
        }
        await sleep(80)
      }
    }
    await sleep(300)
    const won = await evalJS('__h.hasWinPanel()')
    const msg = await evalJS('__h.message()')
    step('completing puzzle shows win panel', won === true, `message=${msg}`)
    await shot('03-easy-won')
  }

  // --- Step 11: hard mode, two-digit keyboard input ---
  await evalJS(`__h.clickButton('主畫面')`)
  await sleep(200)
  await evalJS(`[...document.querySelectorAll('.difficulty-card')].find((c) => c.textContent.includes('困難')).click()`)
  await sleep(150)
  await evalJS(`__h.clickButton('開始新局')`)
  await sleep(400)
  cells = await evalJS('__h.cells()')
  step('hard board 4x4', cells.length === 16, `cells=${cells.length}`)

  // Steps 12-13 need the number 1 to be free: restart until 1 is not prefilled
  for (let retry = 0; retry < 10; retry += 1) {
    const p = await evalJS('__h.progress()')
    if (!p.grid.flat().includes(1)) break
    await evalJS(`__h.clickButton('重開')`)
    await sleep(400)
  }
  cells = await evalJS('__h.cells()')

  {
    const p = await evalJS('__h.progress()')
    const used = new Set(p.grid.flat().filter(Boolean))
    const twoDigit = [10, 11, 12, 13, 14, 15, 16].find((v) => !used.has(v))
    const selIdx = cells.findIndex((c) => c.selected)
    const [d1, d2] = String(twoDigit).split('')
    await evalJS(`__h.keyOnCell(${selIdx}, '${d1}')`)
    await sleep(120)
    await evalJS(`__h.keyOnCell(${selIdx}, '${d2}')`)
    await sleep(200)
    cells = await evalJS('__h.cells()')
    step('two-digit keyboard input works', cells[selIdx].text === String(twoDigit), `typed ${twoDigit}, cell=${cells[selIdx].text}`)
    await shot('04-hard-twodigit')

    // --- Step 12 (probe): pending "1" flushes into the ORIGINAL cell on mouse re-select ---
    if (!used.has(1)) {
      await evalJS(`__h.clickCell(${selIdx})`)
      await evalJS(`__h.clickButton('清除')`)
      await sleep(100)
      const otherIdx = (await evalJS('__h.cells()')).findIndex((c, i) => c.editable && c.text === '' && i !== selIdx)
      await evalJS(`__h.keyOnCell(${selIdx}, '1')`) // starts 900ms buffer
      await sleep(100)
      await evalJS(`__h.clickCell(${otherIdx})`) // must flush 1 into selIdx, not otherIdx
      await sleep(1200) // longer than the old 900ms timer to catch a stale commit
      cells = await evalJS('__h.cells()')
      step(
        'PROBE pending digit commits to original cell on re-select',
        cells[selIdx].text === '1' && cells[otherIdx].text === '',
        `orig=${JSON.stringify(cells[selIdx].text)} other=${JSON.stringify(cells[otherIdx].text)}`,
      )
      await evalJS(`__h.clickCell(${selIdx})`)
      await evalJS(`__h.clickButton('清除')`)
    }

    // --- Step 13 (probe): lone "1" commits after timeout ---
    {
      const idx = (await evalJS('__h.cells()')).findIndex((c) => c.editable && c.text === '')
      await evalJS(`__h.clickCell(${idx})`)
      const before = (await evalJS('__h.cells()'))[idx].text
      await evalJS(`__h.keyOnCell(${idx}, '1')`)
      await sleep(1200)
      cells = await evalJS('__h.cells()')
      step('PROBE lone 1 commits after timeout', cells[idx].text === '1', `before=${JSON.stringify(before)} after=${cells[idx].text}`)
      await evalJS(`__h.clickButton('清除')`)
    }

    // --- Step 14 (probe): Backspace cancels a pending buffer ---
    {
      const idx = (await evalJS('__h.cells()')).findIndex((c) => c.editable && c.text === '')
      await evalJS(`__h.clickCell(${idx})`)
      await evalJS(`__h.keyOnCell(${idx}, '1')`)
      await evalJS(`__h.keyOnCell(${idx}, 'Backspace')`)
      await sleep(1200)
      cells = await evalJS('__h.cells()')
      step('PROBE Backspace cancels pending digit', cells[idx].text === '', `cell=${JSON.stringify(cells[idx].text)}`)
    }
  }

  // --- Step 15 (probe): corrupted localStorage does not crash the app ---
  // Inject the corrupt value on the NEW document, after the old page's
  // pagehide autosave has fired but before the app bundle reads storage.
  const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('math-puzzle-progress', '{"puzzle":{"size":99}}')`,
  })
  await navigate()
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  const recovered = await evalJS(`document.querySelector('h1')?.textContent`)
  const continueDisabled = await evalJS(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('續玩') || b.textContent.includes('繼續'))?.disabled`)
  step('PROBE corrupted save rejected gracefully', recovered === 'Math-puzzle' && continueDisabled === true, `continueDisabled=${continueDisabled}`)
  await shot('05-corrupt-save-recovered')

  const failed = steps.filter((s) => !s.ok)
  console.log(`\n${steps.length - failed.length}/${steps.length} steps passed`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error('FATAL', err)
  process.exit(2)
})
