import { FISH_TYPES } from './fishTypes.js'

export class Store {
  constructor() {
    this.fish = []
    this.decorations = []
    this.coins = 120
    this.selectedId = null
    this.selectedDecorId = null
    this.listeners = []
  }

  subscribe(fn) {
    this.listeners.push(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }

  addFish(fish) {
    this.fish.push(fish)
    this.emit()
  }

  removeFish(id) {
    const i = this.fish.findIndex((f) => f.id === id)
    if (i >= 0) this.fish.splice(i, 1)
    if (this.selectedId === id) this.selectedId = null
    this.emit()
  }

  getFish(id) {
    return this.fish.find((f) => f.id === id)
  }

  select(id) {
    this.selectedId = id
    this.emit()
  }

  buy(typeKey) {
    const t = FISH_TYPES[typeKey]
    if (!t || this.coins < t.price) return false
    this.coins -= t.price
    this.emit()
    return true
  }

  sellValue(fish) {
    const base = FISH_TYPES[fish.typeKey].price
    const cond = (fish.stats.health / 100 + fish.stats.happiness / 100) / 2
    return Math.round(base * (0.4 + 0.6 * cond))
  }

  save(key = 'fishsim') {
    const data = {
      coins: this.coins,
      fish: this.fish.map((f) => ({
        typeKey: f.typeKey,
        stats: f.stats,
      })),
      decorations: this.decorations.map((d) => ({
        typeKey: d.typeKey,
        x: d.mesh.position.x,
        z: d.mesh.position.z,
        ry: d.mesh.rotation.y,
      })),
    }
    try { localStorage.setItem(key, JSON.stringify(data)) } catch (_) {}
  }

  load(key = 'fishsim') {
    let raw
    try { raw = localStorage.getItem(key) } catch (_) { return false }
    if (!raw) return false
    let data
    try { data = JSON.parse(raw) } catch (_) { return false }
    this.coins = data.coins ?? this.coins
    this.selectedId = null
    this.selectedDecorId = null
    return data
  }

  hasSave(key = 'fishsim') {
    try { return !!localStorage.getItem(key) } catch (_) { return false }
  }
}
