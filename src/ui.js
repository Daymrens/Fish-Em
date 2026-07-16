import * as THREE from 'three'
import { FISH_TYPES } from './fishTypes.js'
import { DECOR_TYPES } from './decor.js'
import { applyAudioToggles } from './audio.js'

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

export function foodSVG() {
  return `
    <svg viewBox="0 0 100 60" class="fishsvg" aria-hidden="true">
      <g class="body">
        <circle cx="38" cy="30" r="9" fill="#e0a64b"></circle>
        <circle cx="58" cy="26" r="7" fill="#d98b3a"></circle>
        <circle cx="56" cy="40" r="6" fill="#e8b85e"></circle>
        <circle cx="30" cy="40" r="5" fill="#c97a2e"></circle>
        <circle cx="46" cy="44" r="4" fill="#e0a64b"></circle>
      </g>
    </svg>`
}

export function createUI({ store, scene, camera, renderer, fishLayer, decorationsLayer, gravel, glass, api }) {
  const root = document.getElementById('ui-root')

  const state = { view: 'home', editMode: false, feedMode: false, paletteType: 'plant', fishModal: false, shopModal: false, shopTab: 'fish', panelOpen: false, panelTab: 'tank' }

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
    if (e.target && e.target.closest && e.target.closest('.topbar, .panel, .infopanel, .modal-back, .toast-wrap, [data-action], [data-stop]')) return
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

    if (state.feedMode) {
      const gHits = glass ? raycaster.intersectObject(glass) : []
      let point = null
      if (gHits.length) {
        point = gHits[0].point
      } else {
        point = new THREE.Vector3(0, 0, 0)
      }
      const ok = api.dropFoodAt(point)
      if (ok && store.food <= 0) setFeedMode(false)
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
        <button data-action="feed" class="${state.feedMode ? 'active' : ''}" ${store.food <= 0 ? 'disabled' : ''}>Feed (${store.food})</button>
        <button data-action="shop">Shop</button>
        <button data-action="panel">Menu</button>
      </div>`
    root.appendChild(top)

    const info = document.createElement('div')
    info.className = 'infopanel'
    const fish = store.getFish(store.selectedId)
    if (fish) {
      const s = fish.stats
      info.innerHTML = `
        <div class="info-name-row">
          <input class="info-rename" data-action="rename" data-id="${fish.id}" value="${fish.name.replace(/"/g, '&quot;')}" />
          <span class="tier-badge tier-${fish.type.tier}">${fish.type.tier}</span>
        </div>
        <div class="info-sub">${fish.type.name}</div>
        <div class="stat"><label>Happiness</label><div class="bar"><div class="fill" data-bind="sel-hap-bar" style="width:${s.happiness}%"></div></div><span data-bind="sel-hap">${Math.round(s.happiness)}</span></div>
        <div class="stat"><label>Health</label><div class="bar"><div class="fill hp" data-bind="sel-hp-bar" style="width:${s.health}%"></div></div><span data-bind="sel-hp">${Math.round(s.health)}</span></div>
        <div class="stat"><label>Hunger</label><div class="bar"><div class="fill hun" data-bind="sel-hun-bar" style="width:${s.hunger}%"></div></div><span data-bind="sel-hun">${Math.round(s.hunger)}</span></div>
        <div class="stat"><label>Age</label><span data-bind="sel-age">${s.age.toFixed(0)}</span>s</div>
        <button class="info-sell" data-action="sell" data-id="${fish.id}">Sell (${store.sellValue(fish)})</button>
        <button class="info-save" data-action="save">Save Game</button>`
    } else {
      const cost = store.tankUpgradeCost()
      info.innerHTML = `
        <div class="info-empty">Select a fish to see its details</div>
        <div class="tank-up">
          <div>Tank Level ${store.tankLevel + 1}</div>
          <button class="info-save" data-action="upgrade">Upgrade Tank (${cost})</button>
        </div>`
    }
    root.appendChild(info)

    if (state.panelOpen) {
      const panel = document.createElement('div')
      panel.className = 'panel'
      panel.dataset.drag = '1'
      panel.innerHTML = `
        <div class="panel-head" data-drag-handle="1">
          <span>Menu</span>
          <button class="panel-x" data-action="closepanel">✕</button>
        </div>
        <div class="tabs">
          <button class="tab ${state.panelTab === 'tank' ? 'sel' : ''}" data-action="tab" data-type="tank">Tank</button>
          <button class="tab ${state.panelTab === 'settings' ? 'sel' : ''}" data-action="tab" data-type="settings">Settings</button>
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

    const toast = document.createElement('div')
    toast.className = 'toast-wrap'
    toast.id = 'toast-wrap'
    root.appendChild(toast)

    if (state.shopModal) {
      const tab = state.shopTab
      let body = ''
      if (tab === 'food') {
        body = `
          <div class="fishtile ${store.coins >= 50 ? '' : 'locked'}">
            ${foodSVG()}
            <div class="fishtile-name">Fish Food</div>
            <div class="fishtile-species">x5 / 50c</div>
            <span class="tier-badge tier-common">stock ${store.food}</span>
            <button class="fishtile-buy" data-action="buyfood" ${store.coins >= 50 ? '' : 'disabled'}>Buy x5</button>
          </div>`
      } else if (tab === 'decor') {
        body = Object.entries(DECOR_TYPES).map(([key, d]) => {
          const can = store.coins >= d.price
          return `
          <div class="fishtile ${can ? '' : 'locked'}">
            <div class="fishtile-name">${d.name}</div>
            <div class="fishtile-species">${d.price}</div>
            <button class="fishtile-buy" data-action="pickdecor" data-type="${key}" ${can ? '' : 'disabled'}>Place</button>
          </div>`
        }).join('')
      } else {
        body = Object.entries(FISH_TYPES).map(([key, t]) => {
          const can = store.coins >= t.price
          return `
          <div class="fishtile ${can ? '' : 'locked'}">
            ${fishSVG(t.color)}
            <div class="fishtile-name">${t.name}</div>
            <div class="fishtile-species">${t.price}</div>
            <span class="tier-badge tier-${t.tier}">${t.tier}</span>
            <button class="fishtile-buy" data-action="buy" data-type="${key}" ${can ? '' : 'disabled'}>Buy</button>
          </div>`
        }).join('')
      }
      const modal = document.createElement('div')
      modal.className = 'modal-back'
      modal.dataset.action = 'closeshop'
      modal.innerHTML = `
        <div class="modal" data-stop="1">
          <div class="modal-head">
            <h2>Shop</h2>
            <button class="modal-x" data-action="closeshop">✕</button>
          </div>
          <div class="tabs">
            <button class="tab ${tab === 'fish' ? 'sel' : ''}" data-action="shoptab" data-type="fish">Fish</button>
            <button class="tab ${tab === 'food' ? 'sel' : ''}" data-action="shoptab" data-type="food">Food</button>
            <button class="tab ${tab === 'decor' ? 'sel' : ''}" data-action="shoptab" data-type="decor">Decor</button>
          </div>
          <div class="shop-scroll">
            <div class="modal-grid">${body}</div>
          </div>
          <p class="hint">Pick decor, then click the tank to place it.</p>
        </div>`
      root.appendChild(modal)
    }
  }

  function buildPanel() {
    const wrap = document.createElement('div')

    if (state.panelTab === 'settings') {
      const music = localStorage.getItem('fishsim-music') !== '0'
      const sfx = localStorage.getItem('fishsim-sfx') !== '0'
      wrap.innerHTML = `
        <h2>Settings</h2>
        <label class="set-row">Music
          <input type="checkbox" data-set="music" ${music ? 'checked' : ''}>
        </label>
        <label class="set-row">Sound Effects
          <input type="checkbox" data-set="sfx" ${sfx ? 'checked' : ''}>
        </label>
        <div class="row"><button data-action="save">Save Game</button></div>`
      wrap.querySelectorAll('input[data-set]').forEach((inp) => {
        inp.addEventListener('change', () => {
          localStorage.setItem('fishsim-' + inp.dataset.set, inp.checked ? '1' : '0')
          applyAudioToggles()
        })
      })
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
      <h2>Tank Details</h2>
      <div class="stat"><label>Tank Level</label><span>${store.tankLevel + 1}</span></div>
      <div class="stat"><label>Fish</label><span>${store.fish.length}</span></div>
      <div class="stat"><label>Coins</label><span>${Math.floor(store.coins)}</span></div>
      <div class="stat"><label>Food</label><span>${store.food}</span></div>
      <div class="stat"><label>Decor</label><span>${store.decorations.length}</span></div>
      <div class="fishlist">
        ${store.fish.map((f) => `
          <div class="fishrow" data-action="select" data-id="${f.id}">
            <span>${f.name}</span>
            <span class="mini" data-bind="hap-${f.id}">${Math.round(f.stats.happiness)}</span>
          </div>`).join('')}
      </div>
      <div class="row"><button data-action="save">Save Game</button></div>`
    return wrap
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]')
    if (!t) return
    const a = t.dataset.action
    const id = t.dataset.id
    const type = t.dataset.type
    if (a === 'rename') return
    if (a === 'panel') {
      state.panelOpen = !state.panelOpen
      render()
    } else if (a === 'tab') {
      state.panelTab = type
      render()
    } else if (a === 'shoptab') {
      state.shopTab = type
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
    } else if (a === 'feed') {
      api.setFeedMode(!state.feedMode)
    } else if (a === 'fishmodal') {
      state.fishModal = true
      render()
    } else if (a === 'closemodal') {
      state.fishModal = false
      render()
    } else if (a === 'buy') {
      api.buyFish(type)
    } else if (a === 'buyfood') {
      api.buyFood()
    } else if (a === 'pickdecor') {
      const d = DECOR_TYPES[type]
      if (store.coins < d.price) {
        store.toast('Not enough coins')
        render()
        return
      }
      state.editMode = true
      state.paletteType = type
      state.shopModal = false
      store.selectedDecorId = null
      render()
      store.toast('Click the tank to place ' + d.name)
    } else if (a === 'upgrade') {
      api.upgradeTank()
      render()
    } else if (a === 'save') {
      store.save()
      flashSaved()
    } else if (a === 'rename') {
      api.renameFish(Number(id), e.target.value.trim())
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

  root.addEventListener('change', (e) => {
    const t = e.target.closest('[data-action="rename"]')
    if (t) {
      api.renameFish(Number(t.dataset.id), t.value.trim())
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

  function flashToast(msg) {
    const wrap = root.querySelector('#toast-wrap')
    if (!wrap) return
    const el = document.createElement('div')
    el.className = 'toast'
    el.textContent = msg
    wrap.appendChild(el)
    setTimeout(() => el.classList.add('show'), 10)
    setTimeout(() => {
      el.classList.remove('show')
      setTimeout(() => el.remove(), 400)
    }, 3200)
  }
  store.onToast = flashToast

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

  function setFeedMode(on) {
    state.feedMode = on
    if (on) state.editMode = false
    render()
  }

  store.subscribe(render)
  render()

  return { tick, setFeedMode }
}
