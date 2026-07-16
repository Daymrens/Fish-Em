const puppeteer = require('puppeteer')
const { spawn } = require('child_process')
const PORT = 4322
const ROOT = 'D:/Games/FishSim'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe', shell: true })
  const url = `http://localhost:${PORT}`
  await wait(3000)
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] })
  const page = await browser.newPage()
  const logs = []
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()))
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))
  await page.goto(url, { waitUntil: 'networkidle2' })
  await wait(3000)
  const info = await page.evaluate(() => ({
    hasStart: !!document.getElementById('start-screen'),
    hasStore: !!window.__store,
    hasApi: !!window.__api,
    bodyLen: document.body.innerHTML.length,
    uiRoot: document.getElementById('ui-root') ? document.getElementById('ui-root').innerHTML.slice(0, 200) : 'none',
  }))
  console.log('INFO', JSON.stringify(info, null, 2))
  console.log('LOGS', JSON.stringify(logs.slice(0, 30), null, 2))
  await browser.close()
  preview.kill('SIGTERM')
  process.exit(0)
})().catch((e) => { console.error('ERR', e); process.exit(1) })
