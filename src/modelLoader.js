import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { MODEL_MANIFEST } from './modelManifest.js'
import { FISH_TYPES } from './fishTypes.js'

const gltfLoader = new GLTFLoader()
const fbxLoader = new FBXLoader()

function fitModel(scene, targetLength) {
  const box = new THREE.Box3().setFromObject(scene)
  const size = new THREE.Vector3()
  box.getSize(size)
  const len = Math.max(size.x, size.y, size.z)
  if (len > 0) scene.scale.setScalar(targetLength / len)
}

function loadByExt(url) {
  const lower = url.toLowerCase()
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
    return gltfLoader.loadAsync(url).then((gltf) => ({ scene: gltf.scene, clips: gltf.animations || [] }))
  }
  if (lower.endsWith('.fbx')) {
    return fbxLoader.loadAsync(url).then((group) => ({ scene: group, clips: group.animations || [] }))
  }
  return Promise.reject(new Error('Unsupported model format: ' + url))
}

export async function preloadModels() {
  const map = new Map()
  const entries = Object.entries(MODEL_MANIFEST).filter(([, cfg]) => cfg && cfg.file)
  await Promise.all(
    entries.map(async ([breed, cfg]) => {
      try {
        const data = await loadByExt('/models/' + cfg.file)
        const targetLength = FISH_TYPES[breed].size * 2.6
        fitModel(data.scene, targetLength)
        map.set(breed, data)
      } catch (err) {
        console.warn('Failed to load model for', breed, '(', cfg.file, ')', err)
      }
    })
  )
  return map
}

export function cloneModel(scene) {
  return SkeletonUtils.clone(scene)
}
