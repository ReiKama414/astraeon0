import gsap from 'gsap'
import { useApp } from '../store/useAppStore'
import { travelTo, returnToUniverse, cancelAllTravel } from './navigation/Navigator'
import { rig } from '../scenes/common/cameraRig'

export interface TourStep {
  id: string
  title: [string, string]
  text: [string, string]
  hold: number
  orbit?: number
}

/** "Journey Through the Universe" */
export const JOURNEY: TourStep[] = [
  { id: 'universe', title: ['The Observable Universe', '可觀測宇宙'], text: ['Filaments of galaxies stretch across hundreds of millions of light-years. Our home lies in a quiet corner of this cosmic web.', '星系組成的纖維結構橫跨數億光年，我們的家園位於這張宇宙網中一個寧靜的角落。'], hold: 7, orbit: 0.05 },
  { id: 'milky-way', title: ['The Milky Way', '銀河系'], text: ['A barred spiral of 100–400 billion stars, about 100,000 light-years across.', '由 1000 至 4000 億顆恆星組成的棒旋星系，直徑約 10 萬光年。'], hold: 8, orbit: 0.06 },
  { id: 'sol', title: ['The Solar System', '太陽系'], text: ['One ordinary star, eight planets, and countless smaller worlds — 26,000 light-years from the Galactic Center.', '一顆普通的恆星、八大行星與無數小天體，距銀河中心約 2.6 萬光年。'], hold: 7, orbit: 0.04 },
  { id: 'earth', title: ['Earth', '地球'], text: ['City lights trace the night side while clouds drift over the oceans. Lighting follows the real Sun direction for the current date.', '夜側城市燈火閃爍，雲層飄過海洋。光照方向依據當前日期的真實太陽位置。'], hold: 9, orbit: 0.08 },
  { id: 'saturn', title: ['Saturn', '土星'], text: ['Its rings are 280,000 km wide yet mostly only about ten metres thick.', '土星環寬達 28 萬公里，大部分厚度卻只有約十公尺。'], hold: 8, orbit: 0.08 },
  { id: 'm42', title: ['Orion Nebula', '獵戶座大星雲'], text: ['1,344 light-years away, newborn stars carve a glowing cavity into their parent cloud.', '在 1344 光年外，新生恆星在孕育它們的分子雲中雕刻出發光的空腔。'], hold: 9, orbit: 0.05 },
  { id: 'sgr-a-star', title: ['Sagittarius A*', '人馬座 A*'], text: ['4.3 million solar masses at the heart of our Galaxy. Its gravity bends light into a glowing ring (visual simulation).', '銀河系核心 430 萬倍太陽質量的黑洞，其重力將光線彎曲成發光的環（視覺模擬）。'], hold: 10, orbit: 0.07 },
  { id: 'm31', title: ['Andromeda Galaxy', '仙女座星系'], text: ['Our nearest large neighbour, 2.5 million light-years away — and on a collision course with the Milky Way.', '最近的大型鄰居，距離 250 萬光年，正朝銀河系而來。'], hold: 9, orbit: 0.06 },
]

let token = 0
let holdTween: gsap.core.Tween | null = null
let orbitTween: gsap.core.Tween | null = null
const holdState = { t: 0 }

function setTour(p: Partial<ReturnType<typeof useApp.getState>['tour']>) {
  const s = useApp.getState()
  s.set({ tour: { ...s.tour, ...p } })
}

export const tourProgress = holdState

async function runFrom(step: number) {
  const my = ++token
  for (let i = step; i < JOURNEY.length; i++) {
    if (my !== token) return
    setTour({ step: i })
    const st = JOURNEY[i]
    holdState.t = 0
    if (st.id === 'universe') await returnToUniverse()
    else await travelTo(st.id)
    if (my !== token) return
    rig.lastInput = performance.now()
    orbitTween = gsap.to(rig, { yaw: rig.yaw + (st.orbit ?? 0.05) * st.hold, duration: st.hold, ease: 'none' })
    await new Promise<void>((resolve) => {
      holdTween = gsap.to(holdState, { t: 1, duration: st.hold, ease: 'none', onComplete: resolve })
      if (useApp.getState().tour.paused) {
        holdTween.pause()
        orbitTween?.pause()
      }
    })
  }
  if (my === token) setTour({ active: false, step: 0, paused: false })
}

export function startTour() {
  useApp.getState().set({ tour: { active: true, step: 0, paused: false }, panel: 'none' })
  runFrom(0)
}
export function pauseTour() {
  setTour({ paused: true })
  holdTween?.pause()
  orbitTween?.pause()
}
export function resumeTour() {
  setTour({ paused: false })
  holdTween?.resume()
  orbitTween?.resume()
}
export function skipTour() {
  const s = useApp.getState().tour
  holdTween?.kill()
  orbitTween?.kill()
  const next = s.step + 1
  if (next >= JOURNEY.length) return endTour()
  setTour({ paused: false })
  runFrom(next)
}
export function endTour() {
  token++
  holdTween?.kill()
  orbitTween?.kill()
  cancelAllTravel()
  setTour({ active: false, step: 0, paused: false })
}
