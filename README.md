# Fish'Em

A 3D aquarium pet simulator that runs in the browser, built with **Three.js** + **Vite**.

## Features
- **Start screen** with transparent tank backdrop, animated logo, Play / Load / Settings.
- **Shop** (tabbed): buy **Fish**, **Food**, and **Decor**. Rarity tiers (common / rare / legendary).
- **Feeding**: toggle Feed mode and click anywhere on the tank to drop food pellets. Fish race to the food and eat it (pellets fall and rest on the floor until eaten).
- **Care loop**: hunger, happiness, and health stats; breeding when fish are happy & healthy; death when health hits zero.
- **Economy**: coins, daily reward, achievements, tank upgrades.
- **Decorate mode**: place boats, docks, plants and more; rotate / remove them.
- **Day/night cycle**, ambient underwater audio (Music + SFX toggles), rename fish, save/load to `localStorage`.

## Getting started
```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Project layout
- `src/main.js` — bootstrap, game loop, buying/feeding/breeding logic.
- `src/ui.js` — HUD, shop modal, menu panel, click-to-pick interactions.
- `src/tank.js` — tank mesh, bubbles, food particle system.
- `src/fish.js` — fish models, procedural swim shader, AI (wander / seek food / breed / die).
- `src/store.js` — game state, coins, food, achievements, save/load.
- `src/decor.js` / `src/modelLoader.js` — decor definitions and FBX/GLB loading.
- `src/audio.js` — WebAudio synthesized music + SFX.
- `src/scene.js` — renderer, camera, lights, day/night.

## Testing
`smoketest.cjs` runs a headless (puppeteer) smoke test that boots the built game and verifies feeding, shop tabs, menu, and fish behavior. Requires `npm install` (puppeteer is a devDependency).
