type Handler = (scale: number) => Promise<{ url: string; width: number; height: number }>
let handler: Handler | null = null

export function setCaptureHandler(h: Handler | null) {
  handler = h
}

/** Renders the current frame at `scale`× device resolution and downloads it as PNG. */
export async function captureScreenshot(scale: number) {
  if (!handler) throw new Error('Renderer not ready')
  const shot = await handler(scale)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.download = `astralis-${stamp}.png`
  a.href = shot.url
  document.body.appendChild(a)
  a.click()
  a.remove()
  return shot
}
