const fs = require('fs')
const d = 'public/models'
const DECOR_DENY = ['boat', 'dock', 'lure', 'fishingrod', 'worm', 'turbot', 'flatfish', 'sunfish']

function pretty(f) {
  return f
    .replace(/\.[^.]+$/, '')
    .replace(/_fish/gi, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

const files = fs.readdirSync(d).filter((f) => /\.(glb|gltf|fbx)$/i.test(f))
const map = {}
for (const f of files) {
  const base = f.replace(/\.[^.]+$/, '')
  const key = base.replace(/[^a-z0-9]/gi, '').toLowerCase()
  if (DECOR_DENY.some((x) => key.includes(x))) continue
  if (map[key]) continue
  const name = pretty(f)
  const price = 30 + (Math.abs(hash(key)) % 12) * 10
  map[key] = { file: f, name, price }
}

let out = 'export const MODEL_MANIFEST = {\n'
for (const [k, v] of Object.entries(map)) {
  out += `  ${JSON.stringify(k)}: { file: ${JSON.stringify(v.file)}, name: ${JSON.stringify(v.name)}, price: ${v.price}, color: 0x66bbcc, rot: [0, 0, 0] },\n`
}
out += '}\n'
fs.writeFileSync('src/modelManifest.js', out)
console.log('wrote', Object.keys(map).length, 'entries')
