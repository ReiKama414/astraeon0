import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Keeps a renderer failure from blanking the whole app; offers a clean restart. */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ASTRALIS] render failure', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const zh = typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#010108] p-8 text-center">
        <div className="max-w-md">
          <div className="font-display text-3xl tracking-[0.3em]">ASTRALIS</div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {zh ? '3D 場景發生錯誤，可能是顯示卡資源不足。請重新載入，或在設定中降低畫質。' : 'The 3D scene hit an error — possibly the GPU ran out of resources. Reload to continue, or lower the quality setting.'}
          </p>
          <p className="mt-2 font-mono text-[11px] text-faint">{this.state.error.message}</p>
          <button className="mt-6 rounded-full bg-ink px-5 py-2 text-sm text-[#0a0a1a]" onClick={() => location.reload()}>
            {zh ? '重新載入' : 'Reload'}
          </button>
        </div>
      </div>
    )
  }
}
