import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'

export function Tag({ kind, children }: { kind: 'live' | 'concept'; children: ReactNode }) {
  return (
    <span className={`tag ${kind}`}>
      {kind === 'live' ? 'In production' : 'Customization example'}
      {children ? <> · {children}</> : null}
    </span>
  )
}

export function Reveal({
  delay = 0,
  children,
  y = 18,
  className = '',
}: {
  delay?: number
  children: ReactNode
  y?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration: 0.9, delay, ease: 'power3.out' },
    )
    return () => {
      tween.kill()
    }
  }, [delay, y])
  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  )
}

export function Sequence({
  items,
  gap = 1.12,
  className = 'stack',
}: {
  items: string[]
  gap?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const lines = el.querySelectorAll('.seq-line')
    const tl = gsap.timeline()
    gsap.set(lines, { opacity: 0, y: 22 })
    tl.to(lines, {
      opacity: 1,
      y: 0,
      duration: 0.72,
      stagger: gap,
      ease: 'power3.out',
    })
    return () => {
      tl.kill()
    }
  }, [gap, items])
  return (
    <div ref={ref} className={className}>
      {items.map((t) => (
        <div key={t} className="seq-line">
          {t}
        </div>
      ))}
    </div>
  )
}

export function Stagger({
  children,
  step = 0.12,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  step?: number
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const kids = el.children
    const tl = gsap.timeline({ delay })
    gsap.set(kids, { opacity: 0, y: 14 })
    tl.to(kids, { opacity: 1, y: 0, duration: 0.55, stagger: step, ease: 'power3.out' })
    return () => {
      tl.kill()
    }
  }, [delay, step])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export function Flow({ steps, liveUntil }: { steps: string[]; liveUntil?: number }) {
  return (
    <div className="flow">
      {steps.map((s, i) => (
        <span key={`${s}-${i}`} style={{ display: 'contents' }}>
          {i > 0 && <span className="arrow">↓</span>}
          <span className={`node ${liveUntil == null || i <= liveUntil ? 'live' : 'ghost'}`}>{s}</span>
        </span>
      ))}
    </div>
  )
}

export function Spine({ steps }: { steps: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const nodes = el.querySelectorAll('.spine-node')
    const lines = el.querySelectorAll('.spine-line')
    const tl = gsap.timeline()
    gsap.set(nodes, { opacity: 0, scale: 0.92 })
    gsap.set(lines, { scaleY: 0, transformOrigin: 'top center' })
    tl.to(lines, { scaleY: 1, duration: 0.35, stagger: 0.12, ease: 'power2.out' }, 0.2)
    tl.to(nodes, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.14, ease: 'power3.out' }, 0.1)
    return () => {
      tl.kill()
    }
  }, [steps])
  return (
    <div ref={ref} className="spine">
      {steps.map((n, idx) => (
        <span key={n} style={{ display: 'contents' }}>
          <div className="spine-node">{n}</div>
          {idx < steps.length - 1 && <div className="spine-line" />}
        </span>
      ))}
    </div>
  )
}

export function BrandLockup({ large }: { large?: boolean }) {
  return (
    <div className={`brand-lockup ${large ? 'large' : ''}`}>
      <img src={`${import.meta.env.BASE_URL}aics-logo.png`} alt="AICS" />
      <div>
        <strong>AICS</strong>
        <span>Arabian Integrated Construction Services</span>
      </div>
    </div>
  )
}

export function ProductShell() {
  return (
    <div className="shell" aria-hidden="true">
      <nav>
        <div className="brand-row">
          <img src={`${import.meta.env.BASE_URL}aics-logo.png`} alt="" />
          <div>
            <strong>AICS</strong>
            <small>Arabian Integrated Construction Services</small>
          </div>
        </div>
        {[
          'Dashboard',
          'Terminal',
          'Not returned',
          'Receiving',
          'People',
          'Products',
          'QC',
          'Warehouses',
          'Projects',
          'Roles',
        ].map((n, i) => (
          <div key={n} className={`nav-item ${i === 0 ? 'on' : ''}`}>
            {n}
          </div>
        ))}
      </nav>
      <main>
        <div className="kpis">
          <div className="kpi">
            <span>Inventory</span>
            <strong>Stock</strong>
          </div>
          <div className="kpi">
            <span>Custody</span>
            <strong>Outstanding</strong>
          </div>
          <div className="kpi">
            <span>Quality</span>
            <strong>Due / overdue</strong>
          </div>
          <div className="kpi">
            <span>Projects</span>
            <strong>On site</strong>
          </div>
        </div>
        <div className="sheet">
          <div className="sheet-h">
            <span>Asset</span>
            <span>Status</span>
            <span>Person</span>
            <span>Location</span>
            <span>Time</span>
          </div>
          {[
            ['Tool #1048', 'Issued', 'Asad', 'Site AICS-04', '14:22'],
            ['I17-A', 'In stock', '—', 'Warehouse', 'Yesterday'],
            ['PPE-GLV', 'Cooldown', 'Sujon', 'Store', '11:08'],
            ['Caliper-02', 'QC due', 'QC', 'Lab / store', 'Due soon'],
          ].map((row) => (
            <div key={row[0]} className="sheet-r">
              {row.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export function Dossier({
  status,
  person,
  location,
  project,
  time,
  record,
}: {
  status: string
  person: string
  location: string
  project: string
  time: string
  record: string
}) {
  return (
    <div className="dossier">
      <div>
        <small>Status</small>
        {status}
      </div>
      <div>
        <small>Responsible</small>
        {person}
      </div>
      <div>
        <small>Location</small>
        {location}
      </div>
      <div>
        <small>Project</small>
        {project}
      </div>
      <div>
        <small>Timestamp</small>
        {time}
      </div>
      <div>
        <small>Record</small>
        {record}
      </div>
    </div>
  )
}

export function OrgTree() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const nodes = root.querySelectorAll('.org-node')
    const lines = root.querySelectorAll('.org-line')
    const tl = gsap.timeline()
    gsap.set(nodes, { opacity: 0, y: 10 })
    gsap.set(lines, { scaleY: 0, transformOrigin: 'top center' })
    tl.to(lines, { scaleY: 1, duration: 0.32, stagger: 0.1, ease: 'power2.out' })
    tl.to(nodes, { opacity: 1, y: 0, duration: 0.42, stagger: 0.11, ease: 'power3.out' }, 0.05)
    tl.to(nodes, { opacity: 0.14, duration: 0.75, ease: 'power2.inOut' }, '+=1.4')
    tl.fromTo('.hub-final', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out' }, '-=0.15')
    return () => {
      tl.kill()
    }
  }, [])
  return (
    <div className="org" ref={ref}>
      <div className="org-node">Inventory</div>
      <div className="org-line" />
      <div className="org-split">
        <div className="org-node sub">Logistics</div>
      </div>
      <div className="org-line" />
      <div className="org-node">Project</div>
      <div className="org-line" />
      <div className="org-row">
        <div className="org-node sub">Engineering</div>
        <div className="org-node sub">QC</div>
        <div className="org-node sub">Safety</div>
      </div>
      <div className="org-line" />
      <div className="org-node">Management</div>
      <div className="org-line" />
      <div className="org-node ceo">CEO</div>
    </div>
  )
}
