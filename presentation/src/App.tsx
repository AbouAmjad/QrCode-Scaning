import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import gsap from 'gsap'
import { CHAPTERS } from './data/story'
import { VIEWS } from './sections/Chapters'
import './index.css'

export default function App() {
  const [i, setI] = useState(0)
  const last = CHAPTERS.length - 1
  const go = useCallback((n: number) => {
    setI(Math.max(0, Math.min(last, n)))
  }, [last])

  useEffect(() => {
    let cool = 0
    const next = (d: number) => {
      const now = Date.now()
      if (now - cool < 640) return
      cool = now
      setI((v) => Math.max(0, Math.min(last, v + d)))
    }
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        next(1)
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        next(-1)
      }
      if (e.key === 'Home') go(0)
      if (e.key === 'End') go(last)
      if (e.key.toLowerCase() === 'f') toggleFs()
    }
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 18) return
      next(e.deltaY > 0 ? 1 : -1)
    }
    let touchY = 0
    const onStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      const y = e.changedTouches[0].clientY
      if (Math.abs(y - touchY) < 40) return
      next(y < touchY ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [go, last])

  const View = VIEWS[i]
  const id = CHAPTERS[i].id
  const voidOpen = i === 0

  useLayoutEffect(() => {
    const el = document.querySelector('.stage-inner')
    if (!el) return
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: voidOpen ? 1.1 : 0.7, ease: 'power2.out' })
  }, [i, voidOpen])

  return (
    <div className={`app ${voidOpen ? 'void' : ''}`}>
      <div className="chrome">
        <div className="topbar">
          <div className="mark">
            <img src={`${import.meta.env.BASE_URL}aics-logo.png`} alt="AICS" />
            <span>AICS · Arabian Integrated Construction Services</span>
          </div>
          <div className="actions">
            <button className="icon-btn" title="Fullscreen (F)" onClick={toggleFs}>
              ⛶
            </button>
          </div>
        </div>
        <div className="dots" aria-label="Chapters">
          {CHAPTERS.map((c, n) => (
            <button
              key={c.id}
              className={n === i ? 'on' : ''}
              title={`${c.id} ${c.title}`}
              onClick={() => go(n)}
            />
          ))}
        </div>
        <div className="progress">
          {id} / {String(CHAPTERS.length).padStart(2, '0')}
        </div>
        <div className="hint">Scroll · arrows · space · F fullscreen</div>
      </div>
      <div className="stage" key={id}>
        <div className="stage-inner">
          <View on />
        </div>
      </div>
    </div>
  )
}

function toggleFs() {
  const el = document.documentElement
  if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {})
  else document.exitFullscreen?.().catch(() => {})
}
