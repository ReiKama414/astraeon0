/** Deterministic PRNG utilities — identical seed ⇒ identical sequence on every device. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof mulberry32>

/** Integer hash combining multiple ints into a 32-bit seed. */
export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const p of parts) {
    let x = Math.floor(p) | 0
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff
      h = Math.imul(h, 0x01000193)
      x >>>= 8
    }
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return h >>> 0
}

export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export const range = (r: Rng, a: number, b: number) => a + (b - a) * r()
export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length]
export const gauss = (r: Rng) => {
  const u = Math.max(1e-9, r())
  const v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return a[0]
  }
  return Math.floor(Math.random() * 2 ** 32)
}
