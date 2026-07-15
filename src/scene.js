import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a2a43)
  scene.fog = new THREE.FogExp2(0x0a2a43, 0.018)

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200)
  camera.position.set(0, 8, 22)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.target.set(0, 5, 0)
  controls.maxPolarAngle = Math.PI * 0.495
  controls.minDistance = 8
  controls.maxDistance = 50

  const ambient = new THREE.AmbientLight(0x88bbff, 0.6)
  scene.add(ambient)

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x16384f, 0.5)
  scene.add(hemi)

  const dir = new THREE.DirectionalLight(0xffffff, 1.0)
  dir.position.set(6, 18, 10)
  dir.castShadow = true
  dir.shadow.mapSize.set(1024, 1024)
  dir.shadow.camera.near = 1
  dir.shadow.camera.far = 60
  dir.shadow.camera.left = -20
  dir.shadow.camera.right = 20
  dir.shadow.camera.top = 20
  dir.shadow.camera.bottom = -20
  scene.add(dir)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  return { renderer, scene, camera, controls }
}
