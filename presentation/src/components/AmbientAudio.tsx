import { useCallback, useEffect, useRef, useState } from 'react'

/** Optional cinematic ambient pad — Web Audio, no external file. Off by default. */
export function AmbientAudio() {
  const [on, setOn] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<{ gain: GainNode; oscs: OscillatorNode[] } | null>(null)

  const stop = useCallback(() => {
    nodesRef.current?.oscs.forEach((o) => {
      try { o.stop() } catch { /* already stopped */ }
    })
    nodesRef.current = null
    if (ctxRef.current?.state !== 'closed') {
      ctxRef.current?.close().catch(() => {})
    }
    ctxRef.current = null
  }, [])

  const start = useCallback(async () => {
    stop()
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ctxRef.current = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    const gain = ctx.createGain()
    gain.gain.value = 0.045
    gain.connect(ctx.destination)

    const freqs = [55, 82.5, 110, 165]
    const oscs = freqs.map((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? 'sine' : 'triangle'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.22 / (i + 1)
      osc.connect(g)
      g.connect(gain)
      osc.start()
      return osc
    })

    // Gentle slow LFO on master gain
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.04
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.012
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    lfo.start()

    nodesRef.current = { gain, oscs: [...oscs, lfo] }
  }, [stop])

  useEffect(() => () => stop(), [stop])

  const toggle = () => {
    setOn((v) => {
      const next = !v
      if (next) start()
      else stop()
      return next
    })
  }

  return (
    <button
      type="button"
      className={`icon-btn ambient-btn ${on ? 'on' : ''}`}
      title={on ? 'Ambient sound on — click to mute' : 'Ambient sound off — click to enable'}
      aria-pressed={on}
      onClick={toggle}
    >
      {on ? '♪' : '♫'}
    </button>
  )
}
