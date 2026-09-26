/// <reference lib="webworker" />
import { generateGalaxy } from './galaxyGen'
import { generateCosmicWeb } from './cosmicWebGen'

self.onmessage = (e: MessageEvent) => {
  const { id, kind, args } = e.data
  try {
    if (kind === 'galaxy') {
      const out = generateGalaxy(args.g, args.stars, args.haze, args.unitsPerKpc)
      const transfer = [out.stars.position.buffer, out.stars.color.buffer, out.stars.size.buffer, out.dust.position.buffer, out.dust.color.buffer, out.dust.size.buffer, out.haze.position.buffer, out.haze.color.buffer, out.haze.size.buffer]
      ;(self as unknown as Worker).postMessage({ id, result: out }, transfer as Transferable[])
    } else if (kind === 'cosmic-web') {
      const out = generateCosmicWeb(args.count, args.seed, args.extent)
      ;(self as unknown as Worker).postMessage({ id, result: out }, [out.position.buffer, out.color.buffer, out.size.buffer] as Transferable[])
    }
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
