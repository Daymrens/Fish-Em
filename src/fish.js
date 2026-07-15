import * as THREE from 'three'
import { cloneModel } from './modelLoader.js'
import { MODEL_MANIFEST } from './modelManifest.js'
import { TANK } from './tank.js'

let idCounter = 0

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

function finGeometry(shape) {
  const geo = new THREE.ShapeGeometry(shape)
  geo.rotateY(Math.PI / 2)
  return geo
}

export class Fish {
  constructor(typeKey, typeDef, modelData) {
    this.id = ++idCounter
    this.typeKey = typeKey
    this.type = typeDef
    this.name = typeDef.name + ' #' + this.id
    this.stats = { happiness: 80, health: 100, age: 0, hunger: 20 }
    this.speed = typeDef.speed
    this.tailPhase = Math.random() * Math.PI * 2
    this.flapPhase = Math.random() * Math.PI * 2

    this.isModel = false
    this.bodyMat = null
    this.mesh = new THREE.Group()
    this.mesh.userData.fishId = this.id

    if (modelData) this.useModel(modelData)
    else this.buildProcedural()

    this.mesh.position.set(
      (Math.random() - 0.5) * (TANK.w - 4),
      Math.random() * (TANK.h - 4) + 2,
      (Math.random() - 0.5) * (TANK.d - 4)
    )
    this.heading = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5).normalize()
    this.headPhase = Math.random() * 10
    this.baseScale = this.mesh.scale.x || 1
  }

  buildProcedural() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: this.type.color, roughness: 0.45, metalness: 0.05 })
    this.bodyMat.emissive = new THREE.Color(0x000000)
    const finColor = new THREE.Color(this.type.color).multiplyScalar(0.8)
    this.finMat = new THREE.MeshStandardMaterial({ color: finColor, roughness: 0.6, side: THREE.DoubleSide })

    if (this.typeKey === 'guppy') this.buildGuppy()
    else if (this.typeKey === 'tetra') this.buildTetra()
    else if (this.typeKey === 'angel') this.buildAngel()
    else if (this.typeKey === 'koi') this.buildKoi()
    else this.buildGeneric()
  }

  useModel(data) {
    this.isModel = true
    this.modelRoot = cloneModel(data.scene)

    this.clips = data.clips || []
    this.animated = this.clips.length > 0
    const cfg = MODEL_MANIFEST[this.typeKey] || {}
    this.baseRot = cfg.rot || [0, 0, 0]
    this.modelRoot.rotation.set(this.baseRot[0], this.baseRot[1], this.baseRot[2])

    if (!this.animated) {
      const savedScale = this.modelRoot.scale.clone()
      this.modelRoot.scale.setScalar(1)
      this.modelRoot.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(this.modelRoot)
      this.modelRoot.scale.copy(savedScale)
      this.modelRoot.updateMatrixWorld(true)

      const size = new THREE.Vector3()
      box.getSize(size)
      const lenAxis = size.x >= size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)
      const latAxis = lenAxis.x ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
      const head = lenAxis.x * box.min.x + lenAxis.z * box.min.z
      const tail = lenAxis.x * box.max.x + lenAxis.z * box.max.z
      const bodyLen = size.x * Math.abs(lenAxis.x) + size.z * Math.abs(lenAxis.z)

      this.swimUniforms = {
        uTime: { value: Math.random() * 10 },
        uSpeed: { value: 5 + this.speed * 2 },
        uAmp: { value: bodyLen * 0.08 },
        uWaves: { value: 1.0 },
        uMaskStart: { value: 0.4 },
        uLenAxis: { value: lenAxis },
        uLatAxis: { value: latAxis },
        uHead: { value: head },
        uTail: { value: tail }
      }
    }

    this.modelMats = []
    this.modelRoot.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone()
        if (!this.animated) this.applySwimShader(o.material)
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => this.modelMats.push({ m, base: m.emissive ? m.emissive.getHex() : 0 }))
      }
    })

    this.mesh.add(this.modelRoot)

    if (this.animated) {
      this.mixer = new THREE.AnimationMixer(this.modelRoot)
      this.mixer.clipAction(this.clips[0]).play()
    }
  }

  applySwimShader(material) {
    const u = this.swimUniforms
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = u.uTime
      shader.uniforms.uSpeed = u.uSpeed
      shader.uniforms.uAmp = u.uAmp
      shader.uniforms.uWaves = u.uWaves
      shader.uniforms.uMaskStart = u.uMaskStart
      shader.uniforms.uLenAxis = u.uLenAxis
      shader.uniforms.uLatAxis = u.uLatAxis
      shader.uniforms.uHead = u.uHead
      shader.uniforms.uTail = u.uTail
      shader.vertexShader =
        'uniform float uTime; uniform float uSpeed; uniform float uAmp; uniform float uWaves; uniform float uMaskStart;\n' +
        'uniform vec3 uLenAxis; uniform vec3 uLatAxis; uniform float uHead; uniform float uTail;\n' +
        shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float _coord = dot(transformed, uLenAxis);
        float _frac = clamp((_coord - uHead) / max(0.0001, (uTail - uHead)), 0.0, 1.0);
        float _mask = smoothstep(uMaskStart, 1.0, _frac);
        float _wave = sin(uTime * uSpeed - _frac * 6.2831853 * uWaves) * uAmp * _mask;
        transformed += uLatAxis * _wave;`
      )
    }
    material.needsUpdate = true
  }

  setHighlight(on) {
    if (this.isModel) {
      for (const e of this.modelMats) {
        if (e.m.emissive) {
          e.m.emissive.setHex(on ? 0x2bd6ff : e.base)
          e.m.emissiveIntensity = on ? 0.9 : 1
        }
      }
    } else if (this.bodyMat) {
      this.bodyMat.emissive.setHex(on ? 0x2bd6ff : 0x000000)
      this.bodyMat.emissiveIntensity = on ? 0.9 : 1
    }
    const target = on ? 1.18 : 1
    this.mesh.scale.setScalar(this.baseScale * target)
  }

  makeBody(length, radius, depth, height) {
    const s = this.type.size
    const segs = 18
    const L = s * length
    const pts = []
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      const y = (t - 0.5) * L
      const r = s * radius * (0.12 + Math.sin(Math.PI * Math.pow(t, 0.82)) * 0.9)
      pts.push(new THREE.Vector2(Math.max(0.02, r), y))
    }
    const geo = new THREE.LatheGeometry(pts, 16)
    geo.scale(depth, 1, height)
    geo.rotateX(-Math.PI / 2)
    const m = new THREE.Mesh(geo, this.bodyMat)
    m.castShadow = true
    this.body = m
    this.mesh.add(m)
  }

  addEyes(s, fwdZ, eyeY, eyeX) {
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.16, 10, 10), eyeMat)
      eye.position.set(side * eyeX, eyeY, fwdZ)
      this.mesh.add(eye)
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(s * 0.07, 8, 8), pupilMat)
      pupil.position.set(side * (eyeX + s * 0.08), eyeY, fwdZ - s * 0.13)
      this.mesh.add(pupil)
    }
  }

  setFanTail(s, scale, mat) {
    this.tailPivot = new THREE.Group()
    this.tailPivot.position.z = s * 1.0
    const sh = new THREE.Shape()
    sh.moveTo(0, 0)
    sh.lineTo(-s * scale, s * scale * 0.85)
    sh.lineTo(-s * scale * 0.35, 0)
    sh.lineTo(-s * scale, -s * scale * 0.85)
    sh.closePath()
    const tail = new THREE.Mesh(finGeometry(sh), mat || this.finMat)
    tail.position.z = s * 0.1
    this.tailPivot.add(tail)
    this.mesh.add(this.tailPivot)
  }

  setForkedTail(s, scale, mat) {
    this.tailPivot = new THREE.Group()
    this.tailPivot.position.z = s * 1.05
    const sh = new THREE.Shape()
    sh.moveTo(0, 0)
    sh.lineTo(-s * scale, s * scale * 0.65)
    sh.lineTo(-s * scale * 0.4, 0)
    sh.lineTo(-s * scale, -s * scale * 0.65)
    sh.closePath()
    const tail = new THREE.Mesh(finGeometry(sh), mat || this.finMat)
    tail.position.z = s * 0.1
    this.tailPivot.add(tail)
    this.mesh.add(this.tailPivot)
  }

  setPectorals(s, mat) {
    const pecShape = new THREE.Shape()
    pecShape.moveTo(0, 0)
    pecShape.lineTo(-s * 0.9, -s * 0.2)
    pecShape.lineTo(-s * 0.7, s * 0.4)
    pecShape.closePath()
    const geo = finGeometry(pecShape)
    this.pecL = new THREE.Mesh(geo, mat || this.finMat)
    this.pecL.position.set(-s * 0.5, -s * 0.05, -s * 0.5)
    this.pecL.rotation.z = 0.4
    this.mesh.add(this.pecL)
    this.pecR = new THREE.Mesh(geo, mat || this.finMat)
    this.pecR.position.set(s * 0.5, -s * 0.05, -s * 0.5)
    this.pecR.rotation.z = Math.PI - 0.4
    this.mesh.add(this.pecR)
  }

  buildGeneric() {
    const s = this.type.size
    this.makeBody(2.6, 0.95, 0.7, 1.0)
    this.setForkedTail(s, 1.1)
    this.setPectorals(s)
    this.addEyes(s, -s * 1.15, s * 0.18, s * 0.42)
  }

  buildGuppy() {
    const s = this.type.size
    const tailMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.type.color).lerp(new THREE.Color(0xffffff), 0.3),
      roughness: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    })
    this.makeBody(2.0, 0.95, 0.85, 1.0)
    this.setFanTail(s, 1.7, tailMat)
    this.setPectorals(s, tailMat)
    const dorsalShape = new THREE.Shape()
    dorsalShape.moveTo(-s * 0.5, 0)
    dorsalShape.lineTo(0, s * 0.5)
    dorsalShape.lineTo(s * 0.5, 0)
    dorsalShape.closePath()
    const dorsal = new THREE.Mesh(finGeometry(dorsalShape), tailMat)
    dorsal.position.set(0, s * 0.85, -s * 0.1)
    this.mesh.add(dorsal)
    this.addEyes(s, -s * 0.9, s * 0.15, s * 0.32)
  }

  buildTetra() {
    const s = this.type.size
    this.makeBody(1.8, 0.6, 0.7, 0.85)
    this.setForkedTail(s, 0.8)
    this.setPectorals(s)

    const neonMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00a6ff, emissiveIntensity: 1.3, roughness: 0.3 })
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xaa0000, emissiveIntensity: 0.7, roughness: 0.4 })
    const stripeGeo = new THREE.BoxGeometry(s * 0.06, s * 0.14, s * 1.3)
    const redGeo = new THREE.BoxGeometry(s * 0.06, s * 0.16, s * 0.5)
    for (const side of [1, -1]) {
      const stripe = new THREE.Mesh(stripeGeo, neonMat)
      stripe.position.set(side * s * 0.32, s * 0.2, -s * 0.1)
      this.mesh.add(stripe)
      const red = new THREE.Mesh(redGeo, redMat)
      red.position.set(side * s * 0.32, -s * 0.08, s * 0.55)
      this.mesh.add(red)
    }
    this.addEyes(s, -s * 0.75, s * 0.12, s * 0.26)
  }

  buildAngel() {
    const s = this.type.size
    this.makeBody(1.6, 0.9, 0.35, 1.8)

    const finShape = new THREE.Shape()
    finShape.moveTo(-s * 0.85, 0)
    finShape.lineTo(s * 0.85, 0)
    finShape.lineTo(s * 1.5, s * 1.7)
    finShape.closePath()
    const dorsal = new THREE.Mesh(finGeometry(finShape), this.finMat)
    dorsal.position.set(0, s * 1.35, 0)
    this.body.add(dorsal)
    const anal = new THREE.Mesh(finGeometry(finShape), this.finMat)
    anal.position.set(0, -s * 1.2, 0)
    anal.scale.y = -1
    this.body.add(anal)

    this.setForkedTail(s, 0.7)
    this.setPectorals(s)

    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x222a33, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    const stripeGeo = new THREE.PlaneGeometry(s * 1.5, s * 0.16)
    for (const z of [-s * 0.5, 0, s * 0.5]) {
      for (const side of [1, -1]) {
        const st = new THREE.Mesh(stripeGeo, stripeMat)
        st.rotation.y = Math.PI / 2
        st.position.set(side * s * 0.22, 0, z)
        this.mesh.add(st)
      }
    }
    this.addEyes(s, -s * 1.3, s * 0.4, s * 0.18)
  }

  buildKoi() {
    const s = this.type.size
    this.makeBody(2.8, 1.0, 0.8, 1.1)

    const tailMat = new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    this.setFanTail(s, 1.3, tailMat)
    this.setPectorals(s, tailMat)

    const spotMats = [
      new THREE.MeshStandardMaterial({ color: 0xff7733, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
    ]
    for (let i = 0; i < 6; i++) {
      const mat = spotMats[i % 2]
      const spot = new THREE.Mesh(new THREE.SphereGeometry(s * (0.3 + Math.random() * 0.2), 10, 8), mat)
      const ang = Math.random() * Math.PI * 2
      const rad = s * 0.85
      spot.position.set(Math.cos(ang) * rad * 0.6, Math.abs(Math.sin(ang)) * rad * 0.6 + s * 0.1, (Math.random() - 0.5) * s * 1.8)
      spot.scale.set(0.4, 1, 1)
      this.body.add(spot)
    }
    this.addEyes(s, -s * 1.3, s * 0.2, s * 0.45)
  }

  randomPoint() {
    return new THREE.Vector3(
      (Math.random() - 0.5) * (TANK.w - 3),
      Math.random() * (TANK.h - 3) + 1.5,
      (Math.random() - 0.5) * (TANK.d - 3)
    )
  }

  avoidWalls() {
    const p = this.mesh.position
    const turn = new THREE.Vector3()
    const mx = TANK.w / 2 - 2
    const mz = TANK.d / 2 - 2
    const my = TANK.h - 2
    if (p.x > mx) turn.x -= 1
    if (p.x < -mx) turn.x += 1
    if (p.z > mz) turn.z -= 1
    if (p.z < -mz) turn.z += 1
    if (p.y > my) turn.y -= 1
    if (p.y < 2) turn.y += 1
    if (turn.lengthSq() > 0) {
      this.heading.lerp(turn.normalize(), 0.15).normalize()
    }
  }

  update(dt) {
    const pos = this.mesh.position
    this.avoidWalls()

    this.headPhase += dt
    const wander = Math.sin(this.headPhase * 0.6 + this.id) * 0.6 + (Math.random() - 0.5) * 0.4
    this.heading.applyAxisAngle(new THREE.Vector3(0, 1, 0), wander * dt * 0.9)
    this.heading.y *= 0.95
    this.heading.normalize()

    pos.addScaledVector(this.heading, this.speed * dt)
    pos.x = clamp(pos.x, -TANK.w / 2 + 0.8, TANK.w / 2 - 0.8)
    pos.y = clamp(pos.y, 1.0, TANK.h - 0.8)
    pos.z = clamp(pos.z, -TANK.d / 2 + 0.8, TANK.d / 2 - 0.8)

    this.mesh.lookAt(pos.x + this.heading.x, pos.y + this.heading.y, pos.z + this.heading.z)

    this.tailPhase += dt * (6 + this.speed * 2)
    if (this.isModel) {
      if (this.animated) {
        this.mixer.update(dt)
      } else {
        this.swimUniforms.uTime.value += dt
      }
    } else {
      this.tailPivot.rotation.y = Math.sin(this.tailPhase) * 0.5
      if (this.body) this.body.rotation.y = Math.sin(this.tailPhase * 0.5) * 0.12
      this.flapPhase += dt * 7
      if (this.pecL && this.pecR) {
        this.pecL.rotation.z = 0.4 + Math.sin(this.flapPhase) * 0.35
        this.pecR.rotation.z = Math.PI - 0.4 - Math.sin(this.flapPhase) * 0.35
      }
    }

    this.stats.age += dt
    this.stats.happiness = clamp(this.stats.happiness + (Math.random() - 0.5) * dt * 3, 0, 100)
    this.stats.hunger = clamp(this.stats.hunger + dt * 0.6, 0, 100)
    this.stats.health = clamp(this.stats.health + (Math.random() - 0.5) * dt * 1.5, 0, 100)
  }
}
