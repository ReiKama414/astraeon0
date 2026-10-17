# ASTRALIS

**English** · [繁體中文](./README.zh-TW.md)

> **Cinematic Interactive Universe Explorer** — travel from the observable cosmos to Earth’s night sky in one continuous WebGL experience.

<p align="center">
  <img src="./docs/preview-galaxy.png" alt="ASTRALIS — Milky Way" width="860" />
</p>

<p align="center">
  <a href="https://github.com/ReiKama414/astraeon0"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-ReiKama414%2Fastraeon0-181717?logo=github" /></a>
  <a href="https://reikama414.vercel.app/"><img alt="Portfolio" src="https://img.shields.io/badge/Site-reikama414.vercel.app-0A0A0A" /></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r186-000000?logo=threedotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-All%20Rights%20Reserved-red" />
</p>

<p align="center">
  <strong><a href="https://github.com/ReiKama414/astraeon0">★ Star this repo</a></strong>
  ·
  <a href="https://reikama414.vercel.app/">Portfolio</a>
  ·
  <a href="#quick-start">Quick start</a>
  ·
  <a href="#license--rights">License</a>
</p>

---

## Why ASTRALIS?

Most “space” demos are either a flat sky map or a single solar-system toy. **ASTRALIS** is a *scale-aware* explorer: one navigation graph that stitches **universe → galaxy → star system → planet → night sky → black hole → nebula → fantasy sector** — with cinematic camera travel, bilingual labels, and presentation scales that stay readable without lying about distance.

Built for people who love astronomy *and* craft — designers hunting visual references, curious learners, and anyone who wants the universe to feel *reachable*.

> **Heads-up:** data, scales, and copy may contain mistakes. See [Accuracy disclaimer](#accuracy-disclaimer).

| Scale | What you get |
| --- | --- |
| **Observable Universe** | Cosmic web, Local Group, labeled deep-sky anchors |
| **Galaxies** | Procedural spiral disks (Milky Way, Andromeda, …) |
| **Solar System** | Keplerian orbits, moons, asteroid belt, comets |
| **Exoplanets** | Proxima Centauri, TRAPPIST-1 and more |
| **Black holes** | Gravitational-lensing accretion disks (Sgr A*, M87*) |
| **Nebulae & clusters** | Orion, Crab, Eagle, Pleiades… |
| **Night sky** | Constellation lines + true 3D star distances |
| **Fantasy Worlds** | Procedural galaxies, nebulae, and dream planets |

<p align="center">
  <img src="./docs/preview-earth.png" alt="Earth close-up" width="420" />
  &nbsp;
  <img src="./docs/preview-blackhole.png" alt="Sagittarius A*" width="420" />
</p>

---

## Highlights

- **Continuous travel** — warp between scales with a single `travelTo(id)` navigation graph  
- **Registry-driven cosmos** — celestial objects, scenes, and host relations in one typed registry  
- **Cinematic rendering** — R3F + postprocessing (bloom, vignette, tone mapping, SMAA)  
- **Adaptive quality** — auto / low / medium / high with DPR and mobile-aware paths  
- **Bilingual UI** — English ↔ 繁體中文  
- **Guided tour** — *Journey Through the Universe*  
- **Compare & photo mode** — side-by-side bodies, clean captures  
- **Search everything** — planets, Messier objects, galaxies, fantasy worlds  
- **Simulation clock** — 1× / 10× / 100× / custom time flow  

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, Zustand, Tailwind CSS 4 |
| 3D | Three.js, React Three Fiber, Drei, postprocessing |
| Motion | GSAP |
| Tooling | Vite 8, TypeScript |
| Data hints | NASA / JPL fact sheets & elements, IAU rotation, Meeus (see in-code `dataSource`) |

---

## Quick start

**Requirements:** Node.js 20+ recommended, a GPU with WebGL2.

```bash
git clone https://github.com/ReiKama414/astraeon0.git
cd astraeon0
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server + hot reload |
| `npm run build` | Typecheck + production bundle |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Preview the production build |

---

## Controls (cheat sheet)

| Input | Action |
| --- | --- |
| Drag | Orbit |
| Scroll / pinch | Zoom |
| Double-click label | Travel to object |
| `/` | Search |
| `F` · WASD | Free flight (when enabled) |
| Bottom dock | Time speed, tour, photo, settings |

---

## Project map

```
src/
├── core/          # registry, navigation, coords, data, procedural gen
├── scenes/        # universe · galaxy · solar · sky · nebula · blackhole · fantasy
├── ui/            # HUD, search, info, compare, tour, i18n
├── store/         # Zustand app state
├── workers/       # heavy generation off the main thread
└── dev/harness.ts # dev-only visual QA hooks (window.__h)
```

---

## Screenshots

<p align="center">
  <img src="./docs/preview-sky.png" alt="Night sky with constellations" width="860" />
</p>

More captures live under [`docs/`](./docs/) — feel free to open an issue with your favorite frame.

---

## Accuracy disclaimer

ASTRALIS is an **interactive visualization / learning experience**, not a research-grade ephemeris or navigation system.

- Positions, distances, sizes, textures, and timings may be **simplified, compressed (presentation scale), approximated, or wrong**.
- Catalog entries, translations, labels, and encyclopedia blurbs may contain **errors or outdated values**.
- Procedural and fantasy content is **fictional by design**.
- Do **not** rely on this app for scientific publishing, mission planning, education grading, or any safety-/navigation-critical use.

If you spot a mistake, open an issue — fixes are welcome as reports (code contributions still require written permission under the license below).

---

## Attribution & third-party data

Astronomical **facts and orbital elements** referenced in this project draw from public-domain or openly cited sources (e.g. NASA Planetary Fact Sheet, JPL approximate positions, IAU rotation parameters). Rendering, shaders, procedural content, UI, branding, and original writing remain **original work** of the author unless otherwise noted.

Third-party libraries are used under their respective licenses (React, Three.js, etc.). That does **not** re-license this repository.

### AI assistance

Parts of this project were developed **with assistance from [Claude](https://www.anthropic.com/claude)** (Anthropic).  
Direction, curation, review, and copyright remain with **ReiKama414**. Claude is a tooling aid, not a co-owner or licensor of this repository.

---

## Links

| | |
| --- | --- |
| **GitHub** | https://github.com/ReiKama414/astraeon0 |
| **Author** | [ReiKama414 (Myers)](https://github.com/ReiKama414) |
| **Site** | https://reikama414.vercel.app/ |
| **AI assist** | [Claude](https://www.anthropic.com/claude) (Anthropic) |

If ASTRALIS helped you learn, teach, or daydream — a **star** on GitHub is the best signal that this work should keep expanding.

---

## License / Rights

Copyright (c) ReiKama414. **All rights reserved.**

This project is published for **personal viewing and learning only**.  
Without the copyright holder’s **prior written consent**, you may **not** use, copy, modify, distribute, sublicense, or incorporate this software (or any part of it) into other projects — **commercial or non-commercial**.

- GitHub: https://github.com/ReiKama414/astraeon0  
- Site: https://reikama414.vercel.app/  
- Full text: see [LICENSE](./LICENSE)

For commercial licensing or special permissions, contact the author via GitHub or the portfolio site.

---

<p align="center"><sub>ASTRALIS · by ReiKama414 · with Claude · look up.</sub></p>
