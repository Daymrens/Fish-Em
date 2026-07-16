import * as THREE from 'three'
import { createScene } from './scene.js'
import { createTank } from './tank.js'
import { Fish } from './fish.js'
import { FISH_TYPES } from './fishTypes.js'
import { createDecorMesh, DECOR_TYPES, preloadDecorModels } from './decor.js'
import { Store } from './store.js'
import { createUI } from './ui.js'
import { fishSVG } from './ui.js'
import { preloadModels, loadDecorModels } from './modelLoader.js'
import { audio, applyAudioToggles } from './audio.js'

const SAVE_KEY = 'fishsim'

const canvas = document.getElementById('scene')
const { renderer, scene, camera, controls, setTimeOfDay } = createScene(canvas)
const tank = createTank(scene)
const store = new Store()
window.__store = store

const fishLayer = new THREE.Group()
scene.add(fishLayer)
const decorationsLayer = new THREE.Group()
scene.add(decorationsLayer)

let decorId = 0
let modelMap = null
let started = false

const api = { buyFish, sellFish, buyFood, placeDecor, removeDecor, rotateDecor, feedFish, dropFoodAt, setFeedMode, renameFish, upgradeTank }
window.__api = api

const ui = createUI({ store, scene, camera, renderer, fishLayer, decorationsLayer, gravel: tank.gravel, glass: tank.glass, api })

async function boot() {
  modelMap = await preloadModels()
  preloadDecorModels(await loadDecorModels())
  for (const key of Object.keys(FISH_TYPES)) spawn(key)
  store.emit()
  startScreen()
  const clock = new THREE.Clock()
  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05)
    controls.update()
    tank.update(dt)
    const t = performance.now() * 0.00002
    setTimeOfDay(t)
    for (const f of store.fish) {
      f.update(dt, { foodNearest: tank.foodNearest, consumeFood: tank.consumeFood, foodActive: tank.foodActive })
      f.setHighlight(f.id === store.selectedId)
    }
    const sel = store.getFish(store.selectedId)
    if (sel) {
      controls.target.lerp(sel.mesh.position, 0.04)
    }
    breedCheck(dt)
    ui.tick(dt)
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }
  animate()
}

function breedCheck(dt) {
  if (store.fish.length < 2) return
  const byType = {}
  for (const f of store.fish) {
    if (f.dead || f.breedCooldown > 0) continue
    if (f.stats.happiness < 80 || f.stats.health < 70) continue
    ;(byType[f.typeKey] = byType[f.typeKey] || []).push(f)
  }
  for (const key of Object.keys(byType)) {
    const pair = byType[key]
    if (pair.length < 2) continue
    const a = pair[0]
    const b = pair[1]
    a.breedCooldown = 60
    b.breedCooldown = 60
    const child = spawn(key, {
      color: new THREE.Color(a.overrideColor || a.type.color).lerp(new THREE.Color(b.overrideColor || b.type.color), 0.5).getHex(),
    })
    child.stats.happiness = 90
    child.stats.health = 100
    audio.sfx('breed')
    store.markBreed()
    store.toast('A new ' + a.type.name + ' was born!')
    break
  }
}

function spawn(typeKey, opts = {}) {
  const f = new Fish(typeKey, FISH_TYPES[typeKey], modelMap.get(typeKey), opts)
  if (opts.stats) f.stats = { ...f.stats, ...opts.stats }
  if (opts.name) f.name = opts.name
  if (opts.color) applyFishColor(f, opts.color)
  fishLayer.add(f.mesh)
  store.addFish(f)
  return f
}

function despawn(fish) {
  fishLayer.remove(fish.mesh)
  store.removeFish(fish.id)
}

function buyFish(typeKey) {
  if (store.buy(typeKey)) {
    spawn(typeKey)
    return true
  }
  return false
}

function buyFood() {
  if (store.buyFood(5)) {
    audio.sfx('buy')
    store.toast('Bought 5 fish food (' + store.food + ' total)')
  } else {
    store.toast('Not enough coins')
  }
}

function sellFish(id) {
  const f = store.getFish(id)
  if (!f) return
  store.addCoins(store.sellValue(f))
  despawn(f)
}

function placeDecor(typeKey, pos) {
  const def = DECOR_TYPES[typeKey]
  if (store.coins < def.price) return false
  store.coins -= def.price
  const mesh = createDecorMesh(typeKey)
  mesh.position.set(pos.x, 0.5, pos.z)
  decorationsLayer.add(mesh)
  const id = ++decorId
  mesh.userData.decorId = id
  store.decorations.push({ id, typeKey, mesh })
  store.emit()
  return true
}

function removeDecor(id) {
  const i = store.decorations.findIndex((d) => d.id === id)
  if (i < 0) return
  const d = store.decorations[i]
  decorationsLayer.remove(d.mesh)
  store.coins += Math.round(DECOR_TYPES[d.typeKey].price * 0.5)
  store.decorations.splice(i, 1)
  if (store.selectedDecorId === id) store.selectedDecorId = null
  store.emit()
}

function rotateDecor(id, dir) {
  const d = store.decorations.find((x) => x.id === id)
  if (d) {
    d.mesh.rotation.y += dir * (Math.PI / 6)
    store.emit()
  }
}

function clearTank() {
  for (const f of [...store.fish]) despawn(f)
  for (const d of [...store.decorations]) {
    decorationsLayer.remove(d.mesh)
  }
  store.decorations = []
  decorId = 0
  store.selectedId = null
  store.selectedDecorId = null
}

function newGame() {
  clearTank()
  store.coins = 120
  for (const key of Object.keys(FISH_TYPES)) spawn(key)
  store.emit()
}

function loadGame() {
  const data = store.load(SAVE_KEY)
  if (!data) return false
  clearTank()
  for (const fd of data.fish || []) {
    const f = spawn(fd.typeKey, { stats: fd.stats, name: fd.name, color: fd.color })
    if (f && fd.color) applyFishColor(f, fd.color)
  }
  for (const dd of data.decorations || []) {
    if (!DECOR_TYPES[dd.typeKey]) continue
    const mesh = createDecorMesh(dd.typeKey)
    mesh.position.set(dd.x, 0.5, dd.z)
    mesh.rotation.y = dd.ry || 0
    decorationsLayer.add(mesh)
    const id = ++decorId
    mesh.userData.decorId = id
    store.decorations.push({ id, typeKey: dd.typeKey, mesh })
  }
  const bonus = store.claimDaily()
  if (bonus > 0) store.toast('Daily reward +' + bonus + ' coins')
  store.emit()
  return true
}

function applyFishColor(f, hex) {
  const c = new THREE.Color(hex)
  if (f.bodyMat) f.bodyMat.color.copy(c)
  if (f.isModel) {
    for (const e of f.modelMats) if (e.m.color) e.m.color.lerp(c, 0.6)
  }
  f.overrideColor = hex
}

function beginGame() {
  if (started) return
  started = true
  const overlay = document.getElementById('start-screen')
  if (overlay) overlay.remove()
  audio.init()
  audio.resume()
  applyAudioToggles()
  ui.tick(0)
}

function feedFish() {
  if (store.food <= 0) {
    store.toast('No food! Buy some in the Shop')
    return
  }
  const n = Math.min(6, store.food)
  store.food -= n
  store.emit()
  tank.dropFood(n)
  audio.sfx('feed')
  store.toast('Fed the fish (' + store.food + ' left)')
}

function dropFoodAt(point) {
  if (store.food <= 0) {
    store.toast('No food! Buy some in the Shop')
    ui.setFeedMode(false)
    return false
  }
  store.food -= 1
  store.emit()
  tank.dropFoodAt(point, 1)
  audio.sfx('feed')
  return true
}

function setFeedMode(on) {
  ui.setFeedMode(on)
}

function renameFish(id, name) {
  const f = store.getFish(id)
  if (!f || !name) return
  f.name = name
  store.emit()
}

function upgradeTank() {
  if (store.upgradeTank()) {
    tank.resize(store.tankLevel)
    audio.sfx('buy')
  }
}

function startScreen() {
  const overlay = document.createElement('div')
  overlay.id = 'start-screen'
  overlay.innerHTML = `
    <div class="start-box">
      <div class="start-logo">
        ${fishSVG('#7fd4ff')}
      </div>
      <h1>Fish'Em</h1>
      <p class="start-tag">3D Aquarium Pet Simulator</p>
      <div class="start-actions">
        <button class="start-btn primary" data-act="play">Play</button>
        <button class="start-btn" data-act="load" ${store.hasSave(SAVE_KEY) ? '' : 'disabled'}>Load Save</button>
        <button class="start-btn" data-act="settings">Settings</button>
      </div>
      <p class="start-foot">v1.0 &middot; Drag to look around &middot; Click a fish to inspect</p>
    </div>`
  document.body.appendChild(overlay)

  const box = overlay.querySelector('.start-box')
  overlay.addEventListener('click', (e) => {
    const act = e.target.dataset.act
    if (!act) return
    if (act === 'play') {
      newGame()
      transitionOut(overlay, () => beginGame())
    } else if (act === 'load') {
      if (loadGame()) transitionOut(overlay, () => beginGame())
    } else if (act === 'settings') {
      showSettings(box)
    }
  })
}

function transitionOut(overlay, done) {
  overlay.classList.add('leaving')
  const bubbles = document.createElement('div')
  bubbles.className = 'bubbles'
  for (let i = 0; i < 24; i++) {
    const b = document.createElement('span')
    const size = 6 + Math.random() * 22
    b.style.left = Math.random() * 100 + '%'
    b.style.width = size + 'px'
    b.style.height = size + 'px'
    b.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'
    b.style.animationDelay = (Math.random() * 0.5) + 's'
    bubbles.appendChild(b)
  }
  overlay.appendChild(bubbles)
  setTimeout(() => {
    overlay.remove()
    done()
  }, 900)
}

function showSettings(box) {
  const music = localStorage.getItem('fishsim-music') !== '0'
  const sfx = localStorage.getItem('fishsim-sfx') !== '0'
  box.innerHTML = `
    <h1>Settings</h1>
    <label class="set-row">Music
      <input type="checkbox" data-set="music" ${music ? 'checked' : ''}>
    </label>
    <label class="set-row">Sound Effects
      <input type="checkbox" data-set="sfx" ${sfx ? 'checked' : ''}>
    </label>
    <button class="start-btn" data-act="back">Back</button>`
  box.querySelector('[data-act="back"]').addEventListener('click', () => startScreenRefresh(box))
  box.querySelectorAll('input[data-set]').forEach((inp) => {
    inp.addEventListener('change', () => {
      localStorage.setItem('fishsim-' + inp.dataset.set, inp.checked ? '1' : '0')
      applyAudioToggles()
    })
  })
}

function startScreenRefresh(box) {
  box.innerHTML = `
    <div class="start-logo">${fishSVG('#7fd4ff')}</div>
    <h1>Fish'Em</h1>
    <p class="start-tag">3D Aquarium Pet Simulator</p>
    <div class="start-actions">
      <button class="start-btn primary" data-act="play">Play</button>
      <button class="start-btn" data-act="load" ${store.hasSave(SAVE_KEY) ? '' : 'disabled'}>Load Save</button>
      <button class="start-btn" data-act="settings">Settings</button>
    </div>
    <p class="start-foot">v1.0 &middot; Drag to look around &middot; Click a fish to inspect</p>`
}

boot()
