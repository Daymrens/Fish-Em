import * as THREE from 'three'
import { FISH_TYPES } from './fishTypes.js'
import { DECOR_TYPES } from './decor.js'

export function fishSVG(color) {
  const hex = '#' + color.toString(16).padStart(6, '0')
  return `
    <svg viewBox="0 0 100 60" class="fishsvg" aria-hidden="true">
      <g class="body">
        <ellipse cx="42" cy="30" rx="26" ry="14" fill="${hex}"></ellipse>
        <path class="tail" d="M68 30 L92 16 L92 44 Z" fill="${hex}"></path>
        <path d="M40 14 Q46 2 54 14 Z" fill="${hex}" opacity="0.85"></path>
        <path d="M40 46 Q46 58 54 46 Z" fill="${hex}" opacity="0.85"></path>
        <circle cx="24" cy="27" r="3.4" fill="#0a0a0a"></circle>
        <circle cx="23" cy="26" r="1.1" fill="#ffffff"></circle>
      </g>
    </svg>`
}

export function createUI({ store, scene, camera, renderer, fishLayer, decorationsLayer, gravel, api }) {
  const root = document.getElementById('ui-root')

  const state = { view: 'home', editMode: false, paletteType: 'plant', fishModal: false, shopModal: false, panelOpen: false }

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  let downX = 0
  let downY = 0
  window.addEventListener('pointerdown', (e) => {
    downX = e.clientX
    downY = e.clientY
  })

  function makeDraggable(el, handle) {
    let dragging = false
    let ox = 0
    let oy = 0
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-action]')) return
      dragging = true
      const r = el.getBoundingClientRect()
      ox = e.clientX - r.left
      oy = e.clientY - r.top
      el.style.left = r.left + 'px'
      el.style.top = r.top + 'px'
      el.style.right = 'auto'
      el.style.transform = 'none'
      handle.setPointerCapture(e.pointerId)
      e.preventDefault()
    })
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return
      el.style.left = (e.clientX - ox) + 'px'
      el.style.top = (e.clientY - oy) + 'px'
    })
    handle.addEventListener('pointerup', (e) => {
      dragging = false
      try { handle.releasePointerCapture(e.pointerId) } catch (_) {}
    })
  }

  function setMouse(e) {
    const r = renderer.domElement.getBoundingClientRect()
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }

  function climb(object, key) {
    let o = object
    while (o && o.userData[key] === undefined) o = o.parent
    return o
  }

  function onDown(e) {
    if (e.target !== renderer.domElement) return
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
    setMouse(e)
    raycaster.setFromCamera(mouse, camera)

    if (state.editMode) {
      const dHits = raycaster.intersectObjects(decorationsLayer.children, true)
      if (dHits.length) {
        const o = climb(dHits[0].object, 'decorId')
        if (o) {
          store.selectedDecorId = o.userData.decorId
          render()
          return
        }
      }
      const gHits = raycaster.intersectObject(gravel)
      if (gHits.length) api.placeDecor(state.paletteType, gHits[0].point)
      return
    }

    const fHits = raycaster.intersectObjects(fishLayer.children, true)
    if (fHits.length) {
      const o = climb(fHits[0].object, 'fishId')
      if (o) {
        store.select(o.userData.fishId)
        return
      }
    }
    store.select(null)
  }
  window.addEventListener('click', onDown)

  function render() {
    root.innerHTML = ''

    const top = document.createElement('div')
    top.className = 'topbar'
    top.innerHTML = `
      <div class="coins">Coins: <span data-bind="coins">${Math.floor(store.coins)}</span></div>
      <div class="topbtns">
        <button data-action="shop">Shop</button>
        <button data-action="decor">${state.editMode ? 'Exit Decor' : 'Decorate'}</button>
      </div>`
    root.appendChild(top)

    const info = document.createElement('div')
    info.className = 'infopanel'
    const fish = store.getFish(store.selectedId)
    if (fish) {
      const s = fish.stats
      info.innerHTML = `
        <div class="info-name">${fish.name}</div>
        <div class="info-sub">${fish.type.name}</div>
        <div class="stat"><label>Happiness</label><div class="bar"><div class="fill" data-bind="sel-hap-bar" style="width:${s.happiness}%"></div></div><span data-bind="sel-hap">${Math.round(s.happiness)}</span></div>
        <div class="stat"><label>Health</label><div class="bar"><div class="fill hp" data-bind="sel-hp-bar" style="width:${s.health}%"></div></div><span data-bind="sel-hp">${Math.round(s.health)}</span></div>
        <div class="stat"><label>Hunger</label><div class="bar"><div class="fill hun" data-bind="sel-hun-bar" style="width:${s.hunger}%"></div></div><span data-bind="sel-hun">${Math.round(s.hunger)}</span></div>
        <div class="stat"><label>Age</label><span data-bind="sel-age">${s.age.toFixed(0)}</span>s</div>
        <button class="info-sell" data-action="sell" data-id="${fish.id}">Sell (${store.sellValue(fish)})</button>
        <button class="info-save" data-action="save">Save Game</button>`
    } else {
      info.innerHTML = `<div class="info-empty">Select a fish to see its details</div>`
    }
    root.appendChild(info)

    if (state.panelOpen) {
      const panel = document.createElement('div')
      panel.className = 'panel'
      panel.dataset.drag = '1'
      panel.innerHTML = `
        <div class="panel-head" data-drag-handle="1">
          <span>${state.view === 'shop' ? 'Shop' : state.view === 'decor' ? 'Decorations' : 'Tank Info'}</span>
          <button class="panel-x" data-action="closepanel">✕</button>
        </div>`
      panel.appendChild(buildPanel())
      root.appendChild(panel)
      makeDraggable(panel, panel.querySelector('[data-drag-handle]'))
    }

    const fishBtn = document.createElement('button')
    fishBtn.className = 'viewfish-btn'
    fishBtn.dataset.action = 'fishmodal'
    fishBtn.textContent = 'View Fish (' + store.fish.length + ')'
    root.appendChild(fishBtn)

    if (state.fishModal) {
      const modal = document.createElement('div')
      modal.className = 'modal-back'
      modal.dataset.action = 'closemodal'
      modal.innerHTML = `
        <div class="modal" data-stop="1">
          <div class="modal-head">
            <h2>Fish in Tank (${store.fish.length})</h2>
            <button class="modal-x" data-action="closemodal">✕</button>
          </div>
          <div class="modal-grid">
            ${store.fish.map((f) => `
              <div class="fishtile ${f.id === store.selectedId ? 'sel' : ''}" data-action="select" data-id="${f.id}">
                ${fishSVG(f.type.color)}
                <div class="fishtile-name">${f.name}</div>
                <div class="fishtile-species">${f.type.name}</div>
                <div class="mini" data-bind="hap-${f.id}">${Math.round(f.stats.happiness)}</div>
              </div>`).join('')}
          </div>
        </div>`
      root.appendChild(modal)
    }

    if (state.shopModal) {
      const modal = document.createElement('div')
      modal.className = 'modal-back'
      modal.dataset.action = 'closeshop'
      modal.innerHTML = `
        <div class="modal" data-stop="1">
          <div class="modal-head">
            <h2>Shop</h2>
            <button class="modal-x" data-action="closeshop">✕</button>
          </div>
          <div class="modal-grid">
            ${Object.entries(FISH_TYPES).map(([key, t]) => {
              const can = store.coins >= t.price
              return `
              <div class="fishtile ${can ? '' : 'locked'}">
                ${fishSVG(t.color)}
                <div class="fishtile-name">${t.name}</div>
                <div class="fishtile-species">${t.price}</div>
                <button class="fishtile-buy" data-action="buy" data-type="${key}" ${can ? '' : 'disabled'}>Buy</button>
              </div>`
            }).join('')}
          </div>
          <p class="hint">Buy fish, keep them happy, then sell for more.</p>
        </div>`
      root.appendChild(modal)
    }
  }

  function buildPanel() {
    const wrap = document.createElement('div')

    if (state.view === 'shop') {
      wrap.innerHTML = `<h2>Shop</h2><div class="shopgrid">`
      for (const [key, t] of Object.entries(FISH_TYPES)) {
        const can = store.coins >= t.price
        wrap.innerHTML += `
          <div class="fishtile ${can ? '' : 'locked'}">
            ${fishSVG(t.color)}
            <div class="fishtile-name">${t.name}</div>
            <div class="fishtile-species">${t.price}</div>
            <button class="fishtile-buy" data-action="buy" data-type="${key}" ${can ? '' : 'disabled'}>Buy</button>
          </div>`
      }
      wrap.innerHTML += `</div><p class="hint">Buy fish, keep them happy, then sell for more.</p>`
      return wrap
    }

    if (state.view === 'decor') {
      wrap.innerHTML = `<h2>Decorations</h2><p class="hint">Pick an item, then click the tank floor to place it.</p>`
      for (const [key, d] of Object.entries(DECOR_TYPES)) {
        const sel = state.paletteType === key ? 'sel' : ''
        wrap.innerHTML += `<button class="pal ${sel}" data-action="palette" data-type="${key}">${d.name} (${d.price})</button>`
      }
      const sd = store.decorations.find((x) => x.id === store.selectedDecorId)
      if (sd) {
        const d = DECOR_TYPES[sd.typeKey]
        wrap.innerHTML += `
          <div class="row"><span>Selected: ${d.name}</span></div>
          <div class="row">
            <button data-action="rotL" data-id="${sd.id}">Rotate &lsaquo;</button>
            <button data-action="rotR" data-id="${sd.id}">Rotate &rsaquo;</button>
            <button data-action="rmDecor" data-id="${sd.id}">Remove</button>
          </div>`
      }
      return wrap
    }

    const fish = store.getFish(store.selectedId)
    if (fish) {
      const s = fish.stats
      wrap.innerHTML = `
        <h2>${fish.name}</h2>
        <div class="stat"><label>Species</label><span>${fish.type.name}</span></div>
        <div class="stat"><label>Happiness</label><div class="bar"><div class="fill" data-bind="sel-hap-bar" style="width:${s.happiness}%"></div></div><span data-bind="sel-hap">${Math.round(s.happiness)}</span></div>
        <div class="stat"><label>Health</label><div class="bar"><div class="fill hp" data-bind="sel-hp-bar" style="width:${s.health}%"></div></div><span data-bind="sel-hp">${Math.round(s.health)}</span></div>
        <div class="stat"><label>Hunger</label><div class="bar"><div class="fill hun" data-bind="sel-hun-bar" style="width:${s.hunger}%"></div></div><span data-bind="sel-hun">${Math.round(s.hunger)}</span></div>
        <div class="stat"><label>Age</label><span data-bind="sel-age">${s.age.toFixed(0)}</span>s</div>
        <div class="row"><button data-action="sell" data-id="${fish.id}">Sell (${store.sellValue(fish)})</button></div>`
      return wrap
    }

    wrap.innerHTML = `
      <h2>Your Tank</h2>
      <div class="stat"><label>Fish</label><span>${store.fish.length}</span></div>
      <div class="stat"><label>Coins</label><span>${Math.floor(store.coins)}</span></div>
      <p class="hint">Click a fish to view its stats. Use the Shop to buy more.</p>`
    return wrap
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]')
    if (!t) return
    const a = t.dataset.action
    const id = t.dataset.id
    const type = t.dataset.type
    if (a === 'home') {
      state.view = 'home'
      state.editMode = false
      store.selectedDecorId = null
      state.panelOpen = true
      render()
    } else if (a === 'closepanel') {
      state.panelOpen = false
      render()
    } else if (a === 'shop') {
      state.shopModal = true
      render()
    } else if (a === 'closeshop') {
      state.shopModal = false
      render()
    } else if (a === 'decor') {
      state.editMode = !state.editMode
      state.view = 'decor'
      state.panelOpen = true
      if (!state.editMode) store.selectedDecorId = null
      render()
    } else if (a === 'fishmodal') {
      state.fishModal = true
      render()
    } else if (a === 'closemodal') {
      state.fishModal = false
      render()
    } else if (a === 'palette') {
      state.paletteType = type
      render()
    } else if (a === 'buy') {
      api.buyFish(type)
    } else if (a === 'save') {
      store.save()
      flashSaved()
    } else if (a === 'sell') {
      api.sellFish(Number(id))
    } else if (a === 'select') {
      store.select(Number(id))
      state.fishModal = false
      render()
    } else if (a === 'rotL') {
      api.rotateDecor(Number(id), -1)
    } else if (a === 'rotR') {
      api.rotateDecor(Number(id), 1)
    } else if (a === 'rmDecor') {
      api.removeDecor(Number(id))
    }
  })

  function setBind(name, val) {
    const el = root.querySelector(`[data-bind="${name}"]`)
    if (el) el.textContent = val
  }
  function setWidth(name, val) {
    const el = root.querySelector(`[data-bind="${name}"]`)
    if (el) el.style.width = val + '%'
  }

  function flashSaved() {
    const btn = root.querySelector('[data-action="save"]')
    if (!btn) return
    const old = btn.textContent
    btn.textContent = 'Saved!'
    setTimeout(() => { if (btn.isConnected) btn.textContent = old }, 1200)
  }

  let acc = 0
  function tick(dt) {
    acc += dt
    if (acc < 0.2) return
    acc = 0
    setBind('coins', Math.floor(store.coins))
    const sel = store.getFish(store.selectedId)
    if (sel) {
      setBind('sel-hap', Math.round(sel.stats.happiness))
      setWidth('sel-hap-bar', sel.stats.happiness)
      setBind('sel-hp', Math.round(sel.stats.health))
      setWidth('sel-hp-bar', sel.stats.health)
      setBind('sel-hun', Math.round(sel.stats.hunger))
      setWidth('sel-hun-bar', sel.stats.hunger)
      setBind('sel-age', sel.stats.age.toFixed(0))
    }
    for (const f of store.fish) setBind('hap-' + f.id, Math.round(f.stats.happiness))
  }

  store.subscribe(render)
  render()

  return { tick }
}
