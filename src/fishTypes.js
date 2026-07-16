import { MODEL_MANIFEST } from './modelManifest.js'

const OVERRIDES = {
  koi: { color: 0xffffff, size: 1.4, speed: 1.4 },
  guppy: { color: 0xff7755, size: 0.6, speed: 2.2 },
  tetra: { color: 0x33ccff, size: 0.5, speed: 2.6 },
  angel: { color: 0xffd966, size: 1.0, speed: 1.6 },
  clownfish: { color: 0xff8800, size: 0.7, speed: 2.0 },
  tunafish: { color: 0x335577, size: 1.6, speed: 2.4 },
  tuna: { color: 0x335577, size: 1.6, speed: 2.4 },
  shark: { color: 0x778899, size: 1.8, speed: 2.2 },
  bluetang: { color: 0x2266cc, size: 0.8, speed: 2.0 },
  lionfish: { color: 0xcc4433, size: 0.9, speed: 1.4 },
  betta: { color: 0x3366cc, size: 0.6, speed: 1.8 },
  goldfish: { color: 0xffaa33, size: 0.9, speed: 1.8 },
  puffer: { color: 0xddcc88, size: 0.8, speed: 1.5 },
  piranha: { color: 0x556644, size: 0.7, speed: 2.2 },
  anglerfish: { color: 0x444433, size: 1.1, speed: 1.2 },
  parrotfish: { color: 0x88ccaa, size: 1.0, speed: 1.8 },
  mandarinfish: { color: 0x22aa88, size: 0.6, speed: 1.6 },
  butterflyfish: { color: 0xffcc55, size: 0.7, speed: 1.9 },
  moorishidol: { color: 0xffee99, size: 1.0, speed: 1.7 },
  cowfish: { color: 0xddbb66, size: 0.7, speed: 1.3 },
  zebraclownfish: { color: 0xff8800, size: 0.7, speed: 2.0 },
  royalgramma: { color: 0x9944cc, size: 0.6, speed: 1.8 },
  cardinalsh: { color: 0x336699, size: 0.5, speed: 1.7 },
  coralgrouper: { color: 0xcc6644, size: 1.1, speed: 1.6 },
  redsnapper: { color: 0xcc5544, size: 1.0, speed: 1.7 },
  swordfish: { color: 0x557799, size: 1.7, speed: 2.6 },
  humphead: { color: 0x88aabb, size: 1.5, speed: 1.6 },
  goblinshark: { color: 0xddaabb, size: 1.4, speed: 1.5 },
  blobfish: { color: 0xffaabb, size: 0.9, speed: 1.0 },
  armoredcatfish: { color: 0x776655, size: 1.0, speed: 1.5 },
  blacklionfish: { color: 0x222233, size: 0.9, speed: 1.4 },
  flowerhorn: { color: 0xffaa55, size: 1.0, speed: 1.7 },
  bluegoldfish: { color: 0x88aaff, size: 0.9, speed: 1.8 },
  tang: { color: 0x3399cc, size: 0.8, speed: 2.0 },
  yellowtang: { color: 0xffcc22, size: 0.8, speed: 2.0 },
  flatfish: { color: 0xaaaa88, size: 0.9, speed: 1.3 },
  sunfish: { color: 0x99aabb, size: 1.6, speed: 1.2 },
  turbot: { color: 0xaabb99, size: 1.0, speed: 1.4 },
  worm: { color: 0xccaa88, size: 0.5, speed: 1.0 }
}

const PALETTE = [0xff7755, 0x33ccff, 0xffd966, 0xffffff, 0x66bbcc, 0x88ccaa, 0xcc8844, 0xaa88cc, 0xdd6677]

function tierFor(price) {
  if (price >= 130) return 'legendary'
  if (price >= 90) return 'rare'
  return 'common'
}

function buildFishTypes() {
  const types = {}
  let pi = 0
  for (const [key, cfg] of Object.entries(MODEL_MANIFEST)) {
    const o = OVERRIDES[key] || {}
    const price = o.price != null ? o.price : cfg.price
    types[key] = {
      name: cfg.name,
      color: o.color != null ? o.color : PALETTE[pi++ % PALETTE.length],
      size: o.size != null ? o.size : 0.8,
      speed: o.speed != null ? o.speed : 1.8,
      price,
      tier: tierFor(price)
    }
  }
  return types
}

export const FISH_TYPES = buildFishTypes()
