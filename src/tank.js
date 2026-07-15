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
  }

  return { group, update, gravel }
}
