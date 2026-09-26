import { jdFromDate } from '../coords/UniverseCoordinateSystem'

/**
 * Two independent clocks:
 *  - simulation time (Julian Date) drives orbits/rotations and can be paused or accelerated;
 *  - animation time drives purely visual motion (nebula drift, accretion flow, galaxy shimmer) and never pauses.
 * Kept outside React state so per-frame updates cause no re-renders.
 */
class Clock {
  jd = jdFromDate(new Date())
  /** simulated seconds per real second */
  rate = 1
  paused = false
  anim = 0
  private listeners = new Set<() => void>()

  tick(dt: number) {
    const d = Math.min(dt, 0.1)
    this.anim += d
    if (!this.paused) this.jd += (d * this.rate) / 86400
  }
  setRate(r: number) {
    this.rate = r
    this.emit()
  }
  setPaused(p: boolean) {
    this.paused = p
    this.emit()
  }
  reset() {
    this.jd = jdFromDate(new Date())
    this.rate = 1
    this.paused = false
    this.emit()
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  private emit() {
    this.listeners.forEach((l) => l())
  }
}

export const simClock = new Clock()
