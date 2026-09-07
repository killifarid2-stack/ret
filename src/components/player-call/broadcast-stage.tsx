import { useEffect, useRef, useState } from 'react'

/**
 * Shared 1920x1080 broadcast canvas.
 *
 * The old implementation used COVER scaling, which could crop the outer
 * frames on 4:3 / 16:10 / ultrawide displays. The public-display sizing
 * engine now uses FIT scaling: the complete frame always remains visible,
 * centered and inside the real audience viewport. The background fills the
 * remaining pixels, so no animation is stretched or allowed to overlap a
 * neighboring frame.
 */
export function BroadcastStage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const update = () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const w = Math.max(1, window.innerWidth)
        const h = Math.max(1, window.innerHeight)
        setScale(Math.min(w / 1920, h / 1080))
      })
    }
    update()
    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])

  return (
    <div className="wab-broadcast-stage flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div
        className="wab-broadcast-canvas"
        style={{
          width: 1920,
          height: 1080,
          flex: '0 0 1920px',
          maxWidth: 'none',
          maxHeight: 'none',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
