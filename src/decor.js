import * as THREE from 'three'
import { cloneModel } from './modelLoader.js'
import { MODEL_MANIFEST } from './modelManifest.js'

export const DECOR_TYPES = {
  plant: { name: 'Plant', color: 0x2e8b57, price: 15 },
  rock: { name: 'Rock', color: 0x777777, price: 10 },
  chest: { name: 'Chest', color: 0xcc9933, price: 40 },
  boat: { name: 'Boat', model: 'Boat.fbx', price: 120 },
  dock: { name: 'Dock', model: 'Dock_Long.fbx', price: 90 },
  dockwide: { name: 'Wide Dock', model: 'Dock_Wide.fbx', price: 100 }
}

const MODEL_CACHE = {}

export function preloadDecorModels(map) {
  for (const [k, v] of Object.entries(map || {})) MODEL_CACHE[k] = v
}

export function createDecorMesh(typeKey) {
  const def = DECOR_TYPES[typeKey]
  const g = new THREE.Group()

  if (def.model) {
    const src = MODEL_CACHE[def.model]
    if (src) {
      const m = cloneModel(src)
      m.position.y = 0
      g.add(m)
    }
  } else {
    const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 })
    if (typeKey === 'plant') {
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.2, 6), mat)
        blade.position.set((Math.random() - 0.5) * 0.4, 1.1, (Math.random() - 0.5) * 0.4)
        blade.rotation.z = (Math.random() - 0.5) * 0.4
        g.add(blade)
      }
    } else if (typeKey === 'rock') {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), mat)
      r.position.y = 0.5
      r.scale.y = 0.7
      g.add(r)
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.9), mat)
      box.position.y = 0.4
      g.add(box)
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.2, 0.95),
        new THREE.MeshStandardMaterial({ color: 0x886611 })
      )
      lid.position.y = 0.85
      g.add(lid)
    }
  }

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return g
}

