// Builds src/core/data/generated/sky.json from the d3-celestial catalogue (BSD-3-Clause, © Olaf Frohn):
// Hipparcos stars to V=6, IAU constellation figures & names, proper/Chinese star names, Messier catalogue.
// Run: node scripts/build-sky-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import * as OpenCC from 'opencc-js'

const D = 'node_modules/d3-celestial/data/'
const read = (f) => JSON.parse(readFileSync(D + f, 'utf8'))
const toTW = OpenCC.Converter({ from: 'cn', to: 'tw' })
const ra = (lon) => +(lon < 0 ? lon + 360 : lon).toFixed(4)
const r2 = (x) => +x.toFixed(3)

const starsRaw = read('stars.6.json').features
const names = read('starnames.json')
const namesCn = read('starnames.cn.json')
const cons = read('constellations.json').features
const lines = read('constellations.lines.json').features
const messier = read('messier.json').features

// stars: [hip, ra, dec, mag, bv]
const stars = starsRaw.map((f) => [f.id, ra(f.geometry.coordinates[0]), r2(f.geometry.coordinates[1]), f.properties.mag, f.properties.bv === '' ? 0.6 : +(+f.properties.bv).toFixed(2)])
const byHip = new Map(stars.map((s) => [s[0], s]))

// names for proper-named stars or bright Bayer stars: hip -> [en, zh, bayer, con]
const starNames = {}
for (const [hip, n] of Object.entries(names)) {
  const s = byHip.get(+hip)
  if (!s) continue
  const proper = n.name?.trim()
  if (!proper && s[3] > 4) continue
  const cn = namesCn[hip]?.name
  const zh = n.zh ? toTW(n.zh) : cn ? toTW(cn) : ''
  const bayer = (n.bayer || n.flam || '').trim()
  starNames[hip] = [proper || '', zh, bayer, n.c || '']
}

const conLines = new Map(lines.map((f) => [f.id, f.geometry.coordinates.map((pl) => pl.map(([lon, lat]) => [ra(lon), r2(lat)]))]))
const constellations = cons.map((f) => {
  const p = f.properties
  const pl = conLines.get(f.id) ?? []
  // brightest star lying on the figure
  let best = null
  for (const line of pl)
    for (const [a, d] of line)
      for (const s of stars) {
        if (Math.abs(s[2] - d) < 0.08 && Math.abs(((s[1] - a + 540) % 360) - 180) < 0.08 / Math.max(0.2, Math.cos((d * Math.PI) / 180))) {
          if (!best || s[3] < best[3]) best = s
        }
      }
  return {
    id: f.id,
    en: p.name || p.en,
    zh: toTW(p.zh || ''),
    gen: p.gen,
    rank: +p.rank,
    center: [ra(f.geometry.coordinates[0]), r2(f.geometry.coordinates[1])],
    brightest: best ? best[0] : null,
    lines: pl,
  }
})

const dsos = messier.map((f) => {
  const p = f.properties
  return { id: p.name, desig: p.desig, alt: p.alt?.replace('´', "'") || '', type: p.type, mag: p.mag, dim: p.dim, ra: ra(f.geometry.coordinates[0]), dec: r2(f.geometry.coordinates[1]) }
})

mkdirSync('src/core/data/generated', { recursive: true })
writeFileSync('src/core/data/generated/sky.json', JSON.stringify({ source: 'd3-celestial 0.7.35 (BSD-3-Clause, Olaf Frohn): Hipparcos/Yale BSC stars, IAU figures, Messier', stars, starNames, constellations, dsos }))
console.log('stars', stars.length, 'named', Object.keys(starNames).length, 'constellations', constellations.length, 'messier', dsos.length)
