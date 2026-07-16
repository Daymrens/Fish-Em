import * as THREE from 'three'

export const TANK = { w: 20, h: 12, d: 12 }

export function createTank(scene) {
  const group = new THREE.Group()

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(TANK.w, TANK.h, TANK.d),
    new THREE.MeshStandardMaterial({
      color: 0xaad4ff,
      transparent: true,
      opacity: 0.1,
      roughness: 0.1,
      side: THREE.DoubleSide
    })
  )
  glass.position.y = TANK.h / 2
  group.add(glass)

  const gravel = new THREE.Mesh(
    new THREE.BoxGeometry(TANK.w, 0.5, TANK.d),
    new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 1 })
  )
  gravel.position.y = 0.25
  gravel.receiveShadow = true
  group.add(gravel)

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(TANK.w, TANK.d, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x2b6ca3,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = TANK.h
  group.add(water)

  const bubbleCount = 90
  const positions = new Float32Array(bubbleCount * 3)
  for (let i = 0; i < bubbleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * (TANK.w - 1)
    positions[i * 3 + 1] = Math.random() * TANK.h
    positions[i * 3 + 2] = (Math.random() - 0.5) * (TANK.d - 1)
  }
  const bubbleGeo = new THREE.BufferGeometry()
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const bubbles = new THREE.Points(
    bubbleGeo,
    new THREE.PointsMaterial({ color: 0xcdefff, size: 0.12, transparent: true, opacity: 0.6 })
  )
  group.add(bubbles)

  scene.add(group)

  const foodCount = 60
  const foodPos = new Float32Array(foodCount * 3)
  for (let i = 0; i < foodCount; i++) foodPos[i * 3 + 1] = -10
  const foodGeo = new THREE.BufferGeometry()
  foodGeo.setAttribute('position', new THREE.BufferAttribute(foodPos, 3))
  const food = new THREE.Points(
    foodGeo,
    new THREE.PointsMaterial({ color: 0xffcc66, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.98 })
  )
  group.add(food)
  let foodActive = 0

  function dropFood(n) {
    const pos = foodGeo.attributes.position
    let dropped = 0
    for (let i = 0; i < foodCount && dropped < n; i++) {
      if (foodPos[i * 3 + 1] < -5) {
        foodPos[i * 3] = (Math.random() - 0.5) * (TANK.w - 2)
        foodPos[i * 3 + 1] = TANK.h - 0.5
        foodPos[i * 3 + 2] = (Math.random() - 0.5) * (TANK.d - 2)
        dropped++
      }
    }
    foodActive += dropped
    pos.needsUpdate = true
  }

  function dropFoodAt(point, n = 1) {
    const pos = foodGeo.attributes.position
    let dropped = 0
    const x = clampNum(point.x, -TANK.w / 2 + 1, TANK.w / 2 - 1)
    const z = clampNum(point.z, -TANK.d / 2 + 1, TANK.d / 2 - 1)
    for (let i = 0; i < foodCount && dropped < n; i++) {
      if (foodPos[i * 3 + 1] < -5) {
        foodPos[i * 3] = x + (Math.random() - 0.5) * 0.6
        foodPos[i * 3 + 1] = TANK.h - 0.5
        foodPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6
        dropped++
      }
    }
    foodActive += dropped
    pos.needsUpdate = true
  }

  function clampNum(v, a, b) {
    return Math.max(a, Math.min(b, v))
  }

  function consumeFood(index) {
    foodPos[index * 3 + 1] = -10
    foodActive = Math.max(0, foodActive - 1)
    foodGeo.attributes.position.needsUpdate = true
  }

  function foodNearest(p) {
    let best = -1
    let bestD = 2.0 * 2.0
    for (let i = 0; i < foodCount; i++) {
      const y = foodPos[i * 3 + 1]
      if (y < -5) continue
      const dx = foodPos[i * 3] - p.x
      const dy = foodPos[i * 3 + 1] - p.y
      const dz = foodPos[i * 3 + 2] - p.z
      const d = dx * dx + dy * dy + dz * dz
      if (d < bestD) { bestD = d; best = i }
    }
    if (best < 0) return null
    return { index: best, x: foodPos[best * 3], y: foodPos[best * 3 + 1], z: foodPos[best * 3 + 2] }
  }

  function update(dt) {
    const pos = bubbleGeo.attributes.position
    for (let i = 0; i < bubbleCount; i++) {
      let y = pos.getY(i) + dt * 1.5
      if (y > TANK.h) {
        y = 0.5
        pos.setX(i, (Math.random() - 0.5) * (TANK.w - 1))
        pos.setZ(i, (Math.random() - 0.5) * (TANK.d - 1))
      }
      pos.setY(i, y)
    }
    pos.needsUpdate = true
    water.position.y = TANK.h + Math.sin(performance.now() * 0.001) * 0.06

    const fpos = foodGeo.attributes.position
    for (let i = 0; i < foodCount; i++) {
      if (foodPos[i * 3 + 1] < -5) continue
      if (foodPos[i * 3 + 1] > 1.2) {
        foodPos[i * 3 + 1] -= dt * 1.6
        if (foodPos[i * 3 + 1] < 1.2) foodPos[i * 3 + 1] = 1.2
      }
    }
    fpos.needsUpdate = true
  }

  function resize(level) {
    const s = 1 + level * 0.25
    group.scale.set(s, s, s)
    TANK.w = 20 * s
    TANK.h = 12 * s
    TANK.d = 12 * s
  }

  return { group, glass, update, gravel, dropFood, dropFoodAt, consumeFood, foodNearest, resize, get foodActive() { return foodActive } }
}
