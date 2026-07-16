const puppeteer = require('puppeteer')
const { spawn } = require('child_process')
const PORT = 4334
const ROOT = 'D:/Games/FishSim'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const LAUNCH = { headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] }

;(async () => {
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe', shell: true })
  await wait(3000)
  const browser = await puppeteer.launch(LAUNCH)
  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 700 })
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2' })
  await wait(2500)
  await page.click('[data-act="play"]')
  await wait(1500)

  const diag = await page.evaluate(() => {
    const THREE = window.__store // not THREE; use scene via api? expose? 
    // we don't have THREE/camera here. Expose via window for test.
    return {
      hasCam: !!window.__cam, hasGrav: !!window.__grav,
    }
  })
  console.log('diag', JSON.stringify(diag))
  await browser.close()
  preview.kill('SIGTERM')
  process.exit(0)
})().catch((e) => { console.error('ERR', e); process.exit(1) })
