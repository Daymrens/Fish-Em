const puppeteer = require('puppeteer')
const { spawn } = require('child_process')

const PORT = 4321
const ROOT = 'D:/Games/FishSim'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const LAUNCH = { headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] }

;(async () => {
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe', shell: true })
  await wait(3000)
  const base = `http://localhost:${PORT}`
  console.log('PREVIEW', base)

  const browser = await puppeteer.launch(LAUNCH)
  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 700 })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error' && !/404|FBXLoader|ReadPixels|GL Driver/.test(m.text())) errors.push(m.text()) })
  page.on('pageerror', (e) => { if (!/WebGL|context/.test(e.message)) errors.push('PAGEERROR: ' + e.message) })

  await page.goto(base, { waitUntil: 'networkidle2' })
  await wait(2500)

  const R = {}
  R.startScreen = await page.$('#start-screen') !== null
  await page.click('[data-act="play"]')
  await wait(1500)
  R.storeReady = await page.evaluate(() => !!window.__store && !!window.__api)
  R.fishSpawned = await page.evaluate(() => window.__store.fish.length)

  // Top bar
  R.feedBtn = await page.$('[data-action="feed"]') !== null
  R.shopBtn = await page.$('[data-action="shop"]') !== null
  R.menuBtn = await page.$('[data-action="panel"]') !== null
  R.decorBtnGone = await page.$('[data-action="decor"]') === null

  // Shop tabs
  await page.click('[data-action="shop"]')
  await wait(300)
  R.shopFishTab = await page.$('[data-action="shoptab"][data-type="fish"]') !== null
  R.shopFoodTab = await page.$('[data-action="shoptab"][data-type="food"]') !== null
  R.shopDecorTab = await page.$('[data-action="shoptab"][data-type="decor"]') !== null
  R.shopFishCount = await page.$$eval('[data-action="buy"]', (e) => e.length)
  // switch to food
  await page.click('[data-action="shoptab"][data-type="food"]')
  await wait(200)
  R.shopFoodBuy = await page.$$eval('[data-action="buyfood"]', (e) => e.length)
  // switch to decor
  await page.click('[data-action="shoptab"][data-type="decor"]')
  await wait(200)
  R.shopDecorCount = await page.$$eval('[data-action="pickdecor"]', (e) => e.length)
  await page.click('[data-action="closeshop"]')
  await wait(200)

  // Feed mode + drop + fish race
  await page.evaluate(() => { window.__store.food = 5; window.__store.emit() })
  await wait(150)
  const foodBefore = await page.evaluate(() => window.__store.food)
  const fishBefore = await page.evaluate(() => window.__store.fish.map((f) => ({ x: f.mesh.position.x, z: f.mesh.position.z })))
  await page.evaluate(() => { window.__api.dropFoodAt({ x: 0, y: 6, z: 0 }) })
  await wait(150)
  R.foodConsumed = (await page.evaluate(() => window.__store.food)) === foodBefore - 1
  await wait(2500)
  const fishAfter = await page.evaluate(() => window.__store.fish.map((f) => ({ x: f.mesh.position.x, z: f.mesh.position.z })))
  let moved = 0
  for (let i = 0; i < Math.min(fishBefore.length, fishAfter.length); i++) {
    if (Math.hypot(fishAfter[i].x - fishBefore[i].x, fishAfter[i].z - fishBefore[i].z) > 0.3) moved++
  }
  R.fishRaced = moved
  R.seekingFlag = await page.evaluate(() => window.__store.fish.every((f) => typeof f.seeking === 'boolean'))

  // Menu = tank + settings
  await page.click('[data-action="panel"]')
  await wait(300)
  R.tankTab = await page.$('[data-action="tab"][data-type="tank"]') !== null
  R.settingsTab = await page.$('[data-action="tab"][data-type="settings"]') !== null
  R.tankDetails = await page.$('.fishlist') !== null
  R.upgradeBtn = await page.$('[data-action="upgrade"]') !== null
  await page.click('[data-action="tab"][data-type="settings"]')
  await wait(300)
  R.settingsToggles = await page.$$eval('input[data-set]', (e) => e.length)
  await page.click('[data-action="closepanel"]')
  await wait(200)

  // Feed toggle button
  await page.evaluate(() => { window.__store.food = 3; window.__store.emit() })
  await wait(150)
  await page.click('[data-action="feed"]')
  await wait(200)
  R.feedModeActive = await page.evaluate(() => document.querySelector('[data-action="feed"]').classList.contains('active'))

  R.errors = errors
  console.log('RESULTS', JSON.stringify(R, null, 2))
  await browser.close()
  preview.kill('SIGTERM')
  process.exit(0)
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1) })
