import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import gsap from 'gsap'
import { ARC_PHASES, CHAPTERS, LIVE } from './data/story'
import { VIEWS } from './sections/Chapters'
import './index.css'

export default function App() {
  const [i, setI] = useState(0)
  const last = CHAPTERS.length - 1

  const go = useCallback((n: number) => {
    const next = Math.max(0, Math.min(last, n))
    setI(next)
    const id = CHAPTERS[next].id
    history.replaceState(null, '', `#${id}`)
  }, [last])

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    const idx = CHAPTERS.findIndex((c) => c.id === hash)
    if (idx >= 0) setI(idx)
  }, [])

  useEffect(() => {
    let cool = 0
    const next = (d: number) => {
      const now = Date.now()
      if (now - cool < 640) return
      cool = now
      setI((v) => {
        const n = Math.max(0, Math.min(last, v + d))
        history.replaceState(null, '', `#${CHAPTERS[n].id}`)
        return n
      })
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

  const chapter = CHAPTERS[i]
  const View = VIEWS[i]
  const voidOpen = i === 0
  const pct = ((i + 1) / CHAPTERS.length) * 100

  useLayoutEffect(() => {
    const el = document.querySelector('.stage-inner')
    if (!el) return
    gsap.fromTo(el, { opacity: 0, y: voidOpen ? 0 : 12 }, { opacity: 1, y: 0, duration: voidOpen ? 1.1 : 0.65, ease: 'power2.out' })
  }, [i, voidOpen])

  return (
    <div className={`app ${voidOpen ? 'void' : ''}`}>
      <div className="chrome">
        <div className="topbar">
          <div className="mark">
            <img src={`${import.meta.env.BASE_URL}aics-logo.png`} alt="AICS" />
            <div className="mark-text">
              <strong>AICS</strong>
              <span>Arabian Integrated Construction Services</span>
            </div>
          </div>
          <div className="actions">
            <a className="icon-btn live-link" href={LIVE} title="Open live system">
              ↗
            </a>
            <button className="icon-btn" title="Fullscreen (F)" onClick={toggleFs}>
              ⛶
            </button>
          </div>
        </div>

        <div className="arc-rail" aria-label="Story arc">
          {ARC_PHASES.map((phase) => (
            <span key={phase} className={chapter.arc === phase ? 'on' : ''}>
              {phase}
            </span>
          ))}
        </div>

        <div className="dots" aria-label="Chapters">
          {CHAPTERS.map((c, n) => (
            <button
              key={c.id}
              className={n === i ? 'on' : ''}
              title={`${c.id} · ${c.title}`}
              onClick={() => go(n)}
            />
          ))}
        </div>

        <div className="progress-col">
          <div className="progress-meta">
            <span className="progress-id">{chapter.id}</span>
            <span className="progress-title">{chapter.title}</span>
          </div>
          <div className="progress-bar" aria-hidden="true">
            <div className="progress-fill" style={{ height: `${pct}%`, ['--pct' as string]: `${pct}%` }} />
          </div>
          <span className="progress-count">{String(i + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}</span>
        </div>

        <div className="hint">Scroll · arrows · space · F fullscreen · #chapter in URL</div>
      </div>

      <div className="stage" key={chapter.id}>
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
