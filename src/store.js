import { FISH_TYPES } from './fishTypes.js'

const ACHIEVEMENTS = {
  species5: { name: 'Diverse Tank', desc: 'Own 5 different species', reward: 100 },
  earn1000: { name: 'Tycoon', desc: 'Earn 1000 total coins', reward: 150 },
  firstBreed: { name: 'New Life', desc: 'Breed your first fish', reward: 80 },
  firstDeath: { name: 'Circle of Life', desc: 'Lose your first fish', reward: 20 },
  tankFull: { name: 'Crowded', desc: 'Own 15 fish', reward: 120 },
}

export class Store {
  constructor() {
    this.fish = []
    this.decorations = []
    this.coins = 120
    this.totalEarned = 0
    this.food = 0
    this.selectedId = null
    this.selectedDecorId = null
    this.listeners = []
    this.achievements = new Set()
    this.daily = { lastClaim: null }
    this.tankLevel = 0
    this.onToast = null
  }

  subscribe(fn) {
    this.listeners.push(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }

  toast(msg) {
    if (this.onToast) this.onToast(msg)
  }

  addFish(fish) {
    this.fish.push(fish)
    this.emit()
    this.checkAchievements()
  }

  removeFish(id) {
    const i = this.fish.findIndex((f) => f.id === id)
    if (i >= 0) this.fish.splice(i, 1)
    if (this.selectedId === id) this.selectedId = null
    this.emit()
    this.checkAchievements()
  }

  getFish(id) {
    return this.fish.find((f) => f.id === id)
  }

  select(id) {
    this.selectedId = id
    this.emit()
  }

  addCoins(n) {
    this.coins += n
    if (n > 0) this.totalEarned += n
    this.emit()
    this.checkAchievements()
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

  buyFood(n = 5) {
    const cost = 10 * n
    if (this.coins < cost) return false
    this.coins -= cost
    this.food += n
    this.emit()
    return true
  }

  tankBonus() {
    return 1 + this.tankLevel * 0.25
  }

  tankUpgradeCost() {
    return 200 * (this.tankLevel + 1)
  }

  upgradeTank() {
    const cost = this.tankUpgradeCost()
    if (this.coins < cost) return false
    this.coins -= cost
    this.tankLevel++
    this.emit()
    this.toast('Tank upgraded to level ' + (this.tankLevel + 1))
    return true
  }

  checkAchievements() {
    const species = new Set(this.fish.map((f) => f.typeKey)).size
    if (species >= 5) this.unlock('species5')
    if (this.totalEarned >= 1000) this.unlock('earn1000')
    if (this.fish.length >= 15) this.unlock('tankFull')
  }

  unlock(key) {
    if (this.achievements.has(key)) return
    this.achievements.add(key)
    const a = ACHIEVEMENTS[key]
    if (!a) return
    this.coins += a.reward
    this.totalEarned += a.reward
    this.toast('🏆 ' + a.name + ' (+' + a.reward + ')')
    this.emit()
  }

  markBreed() { this.unlock('firstBreed') }
  markDeath() { this.unlock('firstDeath') }

  save(key = 'fishsim') {
    const data = {
      coins: this.coins,
      totalEarned: this.totalEarned,
      food: this.food,
      fish: this.fish.map((f) => ({
        typeKey: f.typeKey,
        stats: f.stats,
        name: f.name,
        color: f.overrideColor || null,
      })),
      decorations: this.decorations.map((d) => ({
        typeKey: d.typeKey,
        x: d.mesh.position.x,
        z: d.mesh.position.z,
        ry: d.mesh.rotation.y,
      })),
      achievements: [...this.achievements],
      daily: this.daily,
      tankLevel: this.tankLevel,
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
    this.totalEarned = data.totalEarned ?? 0
    this.food = data.food ?? 0
    this.achievements = new Set(data.achievements || [])
    this.daily = data.daily || { lastClaim: null }
    this.tankLevel = data.tankLevel || 0
    this.selectedId = null
    this.selectedDecorId = null
    return data
  }

  claimDaily() {
    const today = new Date().toDateString()
    if (this.daily.lastClaim === today) return 0
    this.daily.lastClaim = today
    const bonus = 50
    this.addCoins(bonus)
    return bonus
  }

  hasSave(key = 'fishsim') {
    try { return !!localStorage.getItem(key) } catch (_) { return false }
  }
}

export { ACHIEVEMENTS }
