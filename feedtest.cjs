const puppeteer = require('puppeteer')
const { spawn } = require('child_process')
const PORT = 4361
const ROOT = 'D:/Games/FishSim'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const LAUNCH = { headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] }

;(async () => {
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe', shell: true })
  await wait(3000)
  const browser = await puppeteer.launch(LAUNCH)
  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 700 })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error' && !/404|FBXLoader|ReadPixels|GL Driver/.test(m.text())) errors.push(m.text()) })
  page.on('pageerror', (e) => { if (!/WebGL|context/.test(e.message)) errors.push('PAGEERROR: ' + e.message) })
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2' })
  await wait(2500)
  await page.click('[data-act="play"]')
  await wait(1500)

  await page.evaluate(() => { window.__store.food = 10; window.__store.emit() })
  await wait(150)
  await page.click('[data-action="feed"]')
  await wait(300)

  const R = {}
  // click center (upper tank) and upper area
  const before = await page.evaluate(() => window.__store.food)
  await page.mouse.click(550, 300)
  await wait(400)
  const afterCenter = await page.evaluate(() => window.__store.food)
  await page.mouse.click(550, 200)
  await wait(400)
  const afterUpper = await page.evaluate(() => window.__store.food)
  R.foodDroppedCenter = before - afterCenter
  R.foodDroppedUpper = afterCenter - afterUpper

  // active food present (pellets falling/resting, not despawned)
  await wait(1500)
  R.foodActive = await page.evaluate(() => {
    // foodActive not exposed; infer via seeking fish or store.food delta
    return window.__store.food
  })
  // pellets should persist (food count unchanged while uneaten)
  R.foodPersist = await page.evaluate(() => window.__store.food)
  R.seeking = await page.evaluate(() => window.__store.fish.filter(f => f.seeking).length)

  R.errors = errors
  console.log('RESULTS', JSON.stringify(R, null, 2))
  await browser.close()
  preview.kill('SIGTERM')
  process.exit(0)
})().catch((e) => { console.error('ERR', e); process.exit(1) })
