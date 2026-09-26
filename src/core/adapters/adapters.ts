import { registry } from '../registry/CelestialRegistry'
import type { CelestialObject, DataSourceRef } from '../registry/types'
import { fetchJsonCached } from './cache'
import { kelvinToRgb } from '../data/stars'

/**
 * Remote catalogue adapters. Components never call external APIs directly:
 *   External API → Adapter (fetch) → normalize() → IndexedDB cache → CelestialRegistry → renderers.
 * These archives do not send CORS headers, so requests go through a same-origin proxy
 * (/proxy/* — configured in vite.config.ts for dev/preview; deploy with an equivalent rewrite).
 * When unreachable, the bundled local dataset remains authoritative.
 */
export interface AdapterResult {
  ok: boolean
  updated: number
  cached?: boolean
  message: string
}

const EXO_SRC: DataSourceRef = { name: 'NASA Exoplanet Archive — Planetary Systems (live query)', url: 'https://exoplanetarchive.ipac.caltech.edu/', license: 'Public, acknowledgement requested' }

interface ExoRow {
  pl_name: string
  pl_orbper: number | null
  pl_orbsmax: number | null
  pl_rade: number | null
  pl_bmasse: number | null
  pl_eqt: number | null
  disc_year: number | null
  discoverymethod: string | null
  sy_dist: number | null
}

function exoIdFor(plName: string): string | null {
  const known: Record<string, string> = { 'Proxima Cen b': 'proxima-b', 'Proxima Cen d': 'proxima-d' }
  if (known[plName]) return known[plName]
  const m = plName.match(/^TRAPPIST-1 ([b-h])$/)
  if (m) return `trappist-1${m[1]}`
  return null
}

export const ExoplanetArchiveAdapter = {
  id: 'nasa-exoplanet-archive',
  async refreshSystem(hostname: string): Promise<AdapterResult> {
    const q = `select pl_name,pl_orbper,pl_orbsmax,pl_rade,pl_bmasse,pl_eqt,disc_year,discoverymethod,sy_dist from ps where default_flag=1 and hostname='${hostname.replace(/'/g, "''")}'`
    const url = `/proxy/exo/TAP/sync?query=${encodeURIComponent(q)}&format=json`
    try {
      const { data, cached } = await fetchJsonCached<ExoRow[]>(url)
      const updates: CelestialObject[] = []
      for (const row of data) {
        const id = exoIdFor(row.pl_name)
        const cur = id ? registry.get(id) : undefined
        if (!cur || cur.sourceType !== 'real') continue
        const phys = { ...cur.physical }
        if (row.pl_orbper != null) phys.orbitalPeriodDays = row.pl_orbper
        if (row.pl_orbsmax != null) phys.distanceAU = row.pl_orbsmax
        if (row.pl_rade != null) {
          phys.radiusEarth = row.pl_rade
          phys.radiusKm = row.pl_rade * 6371
        }
        if (row.pl_bmasse != null) phys.massEarth = { value: row.pl_bmasse, unit: 'M⊕', qualifier: cur.physical.massEarth?.qualifier }
        if (row.pl_eqt != null) phys.temperatureK = row.pl_eqt
        if (row.sy_dist != null) phys.distanceLy = row.sy_dist * 3.261563777
        const discovery = row.disc_year ? `${row.discoverymethod ?? 'Unknown method'}, ${row.disc_year}` : cur.discovery
        updates.push({ ...cur, physical: phys, discovery, dataSource: [EXO_SRC, ...cur.dataSource.filter((d) => d.name !== EXO_SRC.name)], updatedAt: new Date().toISOString().slice(0, 10) })
      }
      registry.upsert(updates)
      return { ok: true, updated: updates.length, cached, message: `${updates.length} planets updated${cached ? ' (from local cache)' : ''}` }
    } catch (e) {
      return { ok: false, updated: 0, message: `Archive unreachable — showing bundled data (${String((e as Error).message ?? e)})` }
    }
  },
}

interface HorizonsResp {
  result: string
}

const HORIZONS_CODES: Record<string, string> = { mercury: '199', venus: '299', earth: '399', mars: '499', jupiter: '599', saturn: '699', uranus: '799', neptune: '899', pluto: '999', moon: '301' }

export const HorizonsAdapter = {
  id: 'jpl-horizons',
  supports: (id: string) => id in HORIZONS_CODES,
  /** Pulls physical parameters from the Horizons object-data header and merges them. */
  async refreshBody(id: string): Promise<AdapterResult> {
    const code = HORIZONS_CODES[id]
    if (!code) return { ok: false, updated: 0, message: 'Not a Horizons major body' }
    const url = `/proxy/horizons/api/horizons.api?format=json&COMMAND='${code}'&OBJ_DATA='YES'&MAKE_EPHEM='NO'`
    try {
      const { data, cached } = await fetchJsonCached<HorizonsResp>(url, 30 * 86400000)
      const txt = data.result ?? ''
      const num = (re: RegExp) => {
        const m = txt.match(re)
        return m ? parseFloat(m[1].replace(/[^0-9.eE+-]/g, '')) : undefined
      }
      const cur = registry.get(id)
      if (!cur) return { ok: false, updated: 0, message: 'Unknown body' }
      const radius = num(/Vol\. [Mm]ean [Rr]adius[^=]*=\s*([0-9.]+)/)
      const density = num(/Density[^=]*=\s*([0-9.]+)/)
      const phys = { ...cur.physical }
      if (radius) phys.radiusKm = radius
      if (density) phys.density = density < 20 ? density * 1000 : density
      registry.upsert([{ ...cur, physical: phys, dataSource: [{ name: 'JPL Horizons (live query)', url: 'https://ssd.jpl.nasa.gov/horizons/', license: 'Public domain (NASA/JPL)' }, ...cur.dataSource.filter((d) => !d.name.startsWith('JPL Horizons'))], updatedAt: new Date().toISOString().slice(0, 10) }])
      return { ok: true, updated: 1, cached, message: `Updated from JPL Horizons${cached ? ' (cached)' : ''}` }
    } catch (e) {
      return { ok: false, updated: 0, message: `Horizons unreachable — showing bundled data (${String((e as Error).message ?? e)})` }
    }
  },
}

interface GaiaResp {
  metadata: { name: string }[]
  data: (number | string | null)[][]
}

function bpRpToColor(bprp: number) {
  // approximate Teff from Gaia BP−RP (Mucciarelli & Bellazzini 2020 style polynomial, dwarfs)
  const t = 5040 / (0.4929 + 0.5092 * bprp - 0.0353 * bprp * bprp)
  const [r, g, b] = kelvinToRgb(Math.max(2500, Math.min(30000, t)))
  const h = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return { color: `#${h(r)}${h(g)}${h(b)}`, temp: t }
}

export const GaiaAdapter = {
  id: 'esa-gaia-dr3',
  /** Cone search for the brightest stars around a sky position — batch-loaded, never the full catalogue. */
  async loadField(raDeg: number, decDeg: number, radiusDeg = 12, limit = 800): Promise<AdapterResult> {
    const adql = `SELECT TOP ${limit} source_id, ra, dec, phot_g_mean_mag, bp_rp, parallax FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${raDeg.toFixed(4)}, ${decDeg.toFixed(4)}, ${radiusDeg})) AND phot_g_mean_mag < 9.5 AND parallax > 0 ORDER BY phot_g_mean_mag ASC`
    const url = `/proxy/gaia/tap-server/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=${encodeURIComponent(adql)}`
    try {
      const { data, cached } = await fetchJsonCached<GaiaResp>(url, 30 * 86400000, 30000)
      const cols = data.metadata.map((m) => m.name)
      const ix = (n: string) => cols.indexOf(n)
      const objs: CelestialObject[] = []
      for (const row of data.data) {
        const sid = String(row[ix('source_id')])
        const id = `gaia-dr3-${sid}`
        if (registry.get(id)) continue
        const g = Number(row[ix('phot_g_mean_mag')])
        const bprp = row[ix('bp_rp')] == null ? 0.8 : Number(row[ix('bp_rp')])
        const plx = Number(row[ix('parallax')])
        const distPc = plx > 0 ? 1000 / plx : 0
        const { color, temp } = bpRpToColor(bprp)
        objs.push({
          id,
          name: `Gaia DR3 ${sid}`,
          type: 'star',
          sourceType: 'real',
          parentId: 'celestial-sphere',
          position: { kind: 'equatorial', raDeg: Number(row[ix('ra')]), decDeg: Number(row[ix('dec')]), distancePc: distPc },
          physical: { apparentMagnitude: g, distanceLy: distPc ? distPc * 3.261563777 : undefined, temperatureK: Math.round(temp / 10) * 10, extra: { 'Gaia G mag': g.toFixed(2), 'BP−RP': bprp.toFixed(2), Parallax: `${plx.toFixed(3)} mas` } },
          visual: { renderer: 'star', starColor: color, magnitude: g },
          discoveryStatus: 'confirmed',
          description: `A star from the ESA Gaia DR3 catalogue (G = ${g.toFixed(2)}).`,
          descriptionZh: `來自 ESA Gaia DR3 星表的恆星（G = ${g.toFixed(2)}）。`,
          dataSource: [{ name: 'ESA Gaia DR3 (Gaia Collaboration 2023)', url: 'https://gea.esac.esa.int/archive/', license: 'CC BY-SA 3.0 IGO' }],
          updatedAt: new Date().toISOString().slice(0, 10),
        })
      }
      registry.upsert(objs)
      return { ok: true, updated: objs.length, cached, message: `${objs.length} Gaia DR3 stars loaded${cached ? ' (cached)' : ''}` }
    } catch (e) {
      return { ok: false, updated: 0, message: `Gaia archive unreachable (${String((e as Error).message ?? e)})` }
    }
  },
}
