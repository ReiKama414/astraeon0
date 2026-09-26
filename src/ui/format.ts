import type { CelestialObject } from '../core/registry/types'
import { formatDistanceLy } from '../core/coords/UniverseCoordinateSystem'
import type { Lang } from './i18n'

const sup: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
export function sci(v: number, digits = 3) {
  if (v === 0) return '0'
  const e = Math.floor(Math.log10(Math.abs(v)))
  if (e >= -2 && e < 6) return v.toLocaleString('en-US', { maximumSignificantDigits: digits })
  const m = v / 10 ** e
  return `${m.toFixed(digits - 1)} × 10${String(e).split('').map((c) => sup[c] ?? c).join('')}`
}

export interface Row {
  key: string
  label: [string, string]
  value: string
  numeric?: number
}

/** Type-aware property rows. Missing values are reported as Unknown, never invented. */
export function propertyRows(o: CelestialObject, lang: Lang, full = false): Row[] {
  const p = o.physical
  const U = lang === 'zh' ? '未知' : 'Unknown'
  const rows: Row[] = []
  const add = (key: string, label: [string, string], value: string | undefined, numeric?: number) => rows.push({ key, label, value: value ?? U, numeric })
  const t = o.type
  const body = ['planet', 'moon', 'dwarf-planet', 'exoplanet', 'fantasy-planet', 'star', 'comet'].includes(t)
  if (t === 'moon' && o.position.kind === 'orbit') {
    const a = o.position.orbit.a
    add('distance', ['Orbit radius', '軌道半徑'], `${a.toLocaleString('en-US')} km`, a / 9.4607e12)
  } else if (t !== 'universe' && t !== 'constellation') {
    const home = p.distanceLy === 0 && (t === 'galaxy' || t === 'star-system')
    const d = home ? (lang === 'zh' ? '我們所在之處' : 'You are here') : p.distanceLy !== undefined && p.distanceLy > 0 ? formatDistanceLy(p.distanceLy) : p.distanceAU !== undefined ? `${p.distanceAU.toLocaleString('en-US', { maximumSignificantDigits: 4 })} AU${t === 'exoplanet' || t === 'fantasy-planet' || t === 'planet' || t === 'dwarf-planet' ? (lang === 'zh' ? '（軌道半長軸）' : ' (semi-major axis)') : ''}` : undefined
    add('distance', ['Distance', '距離'], d, p.distanceLy ?? (p.distanceAU !== undefined ? p.distanceAU / 63241.077 : undefined))
  }
  if (body) {
    const r = p.radiusKm ?? (p.radiusEarth ? p.radiusEarth * 6371 : undefined)
    add('radius', ['Radius', '半徑'], r !== undefined ? `${sci(r, 4)} km${p.radiusEarth ? ` (${p.radiusEarth.toFixed(2)} R⊕)` : ''}` : undefined, r)
    const massKg = p.massKg ?? (p.massSolar ? p.massSolar * 1.989e30 : p.massEarth ? p.massEarth.value * 5.972e24 : undefined)
    add('mass', ['Mass', '質量'], p.massKg ? `${sci(p.massKg)} kg` : p.massEarth ? `${p.massEarth.qualifier ?? ''}${p.massEarth.value} ${p.massEarth.unit}` : p.massSolar ? `${sci(p.massSolar)} M☉` : undefined, massKg)
    add('temperature', ['Temperature', '溫度'], p.temperatureK !== undefined ? `${Math.round(p.temperatureK).toLocaleString()} K (${Math.round(p.temperatureK - 273.15).toLocaleString()} °C)` : undefined, p.temperatureK)
    if (t !== 'star') add('period', ['Orbital period', '公轉週期'], p.orbitalPeriodDays !== undefined ? (p.orbitalPeriodDays > 730 ? `${(p.orbitalPeriodDays / 365.25).toFixed(2)} years` : `${p.orbitalPeriodDays.toLocaleString('en-US', { maximumSignificantDigits: 5 })} days`) : undefined, p.orbitalPeriodDays)
    if (full || t === 'planet') add('rotation', ['Rotation period', '自轉週期'], p.rotationPeriodHours !== undefined ? `${Math.abs(p.rotationPeriodHours).toLocaleString('en-US', { maximumSignificantDigits: 5 })} h${p.rotationPeriodHours < 0 ? (lang === 'zh' ? '（逆行）' : ' (retrograde)') : ''}` : undefined, p.rotationPeriodHours)
    if (full) {
      add('tilt', ['Axial tilt', '轉軸傾角'], p.axialTiltDeg !== undefined ? `${p.axialTiltDeg}°` : undefined)
      add('gravity', ['Surface gravity', '表面重力'], p.surfaceGravity !== undefined ? `${p.surfaceGravity} m/s²` : undefined)
      add('density', ['Mean density', '平均密度'], p.density !== undefined ? `${p.density.toLocaleString()} kg/m³` : undefined)
      if (t !== 'star') add('moons', ['Known moons', '已知衛星'], p.moons)
    }
    if (t === 'star') {
      add('spectral', ['Spectral type', '光譜型'], p.spectralType)
      if (p.apparentMagnitude !== undefined) add('mag', ['Apparent magnitude', '視星等'], p.apparentMagnitude.toFixed(2))
    }
  } else if (t === 'galaxy' || t === 'galaxy-group') {
    add('diameter', ['Diameter', '直徑'], p.diameterLy ? `${p.diameterLy.toLocaleString()} ly` : undefined, p.diameterLy)
    if (t === 'galaxy') {
      add('morphology', ['Morphology', '形態'], p.morphology)
      add('stars', ['Stars', '恆星數'], p.starCount)
      add('mass', ['Mass', '質量'], p.massSolar ? `~${sci(p.massSolar)} M☉` : undefined, p.massSolar ? p.massSolar * 1.989e30 : undefined)
    }
  } else if (t === 'black-hole') {
    add('mass', ['Mass', '質量'], p.massSolar ? `${sci(p.massSolar, 4)} M☉` : undefined, p.massSolar ? p.massSolar * 1.989e30 : undefined)
    const rs = p.massSolar ? p.massSolar * 2.953 : undefined
    add('horizon', ['Schwarzschild radius', '史瓦西半徑'], rs ? `${sci(rs)} km` : undefined, rs)
  } else if (t === 'nebula') {
    add('diameter', ['Diameter', '直徑'], p.diameterLy ? `~${p.diameterLy} ly` : undefined, p.diameterLy)
    if (p.apparentMagnitude !== undefined) add('mag', ['Apparent magnitude', '視星等'], String(p.apparentMagnitude))
  } else if (t === 'star-system') {
    add('stars', ['Stars', '恆星'], p.starCount ?? p.spectralType)
    if (p.temperatureK) add('temperature', ['Star temperature', '恆星溫度'], `${p.temperatureK.toLocaleString()} K`, p.temperatureK)
  }
  if (full && p.extra) for (const [k, v] of Object.entries(p.extra)) rows.push({ key: `x-${k}`, label: [k, k], value: v })
  return rows
}

export function formatSimDate(d: Date) {
  const y = d.getUTCFullYear()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${y}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

export function formatRate(rate: number) {
  if (rate < 60) return `×${Math.round(rate)}`
  const perSec = rate / 86400
  if (perSec < 1) return `×${Math.round(rate).toLocaleString()} · ${(rate / 3600).toFixed(1)} h/s`
  if (perSec < 365) return `×${sci(rate, 2)} · ${perSec.toFixed(1)} d/s`
  return `×${sci(rate, 2)} · ${(perSec / 365.25).toFixed(1)} yr/s`
}
