import { useSyncExternalStore } from 'react'
import { labelEntries, labelsVersion, subscribeLabels } from '../scenes/common/labels'
import { useApp } from '../store/useAppStore'
import { displayName } from './i18n'
import { selectObject } from '../scenes/common/CelestialMarker'
import { travelTo } from '../core/navigation/Navigator'

/** DOM layer for 3D-anchored labels (positions are written by LabelProjector inside the canvas). */
export function LabelLayer() {
  useSyncExternalStore(subscribeLabels, labelsVersion)
  const lang = useApp((s) => s.lang)
  const show = useApp((s) => s.showLabels && !s.photoMode)
  const selectedId = useApp((s) => s.selectedId)
  if (!show) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {[...labelEntries.entries()].map(([key, e]) => (
        <div
          key={key}
          ref={(el) => {
            e.el = el
          }}
          className="astr-label-wrap"
          style={{ position: 'absolute', left: 0, top: 0, opacity: 0 }}
        >
          <div
            className={`astr-label ${selectedId === e.obj.id ? 'is-selected' : ''} ${e.obj.sourceType !== 'real' ? 'is-fiction' : ''} ${e.className}`}
            onClick={(ev) => {
              ev.stopPropagation()
              selectObject(e.obj.id)
            }}
            onDoubleClick={(ev) => {
              ev.stopPropagation()
              travelTo(e.obj.id)
            }}
          >
            <span className="astr-label-tick" />
            <span className="astr-label-text">{displayName(e.obj, lang)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
