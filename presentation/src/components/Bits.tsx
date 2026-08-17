import type { ReactNode } from 'react'

export function Tag({ kind, children }: { kind: 'live' | 'concept'; children: ReactNode }) {
  return <span className={`tag ${kind}`}>{kind === 'live' ? 'In production' : 'Customization example'} · {children}</span>
}

export function Lines({ items, on }: { items: string[]; on: boolean }) {
  return (
    <div className="stack">
      {items.map((t, i) => (
        <div key={t} className={`line ${on ? 'on' : ''}`} style={{ transitionDelay: `${i * 90}ms` }}>{t}</div>
      ))}
    </div>
  )
}

export function Flow({ steps, liveUntil }: { steps: string[]; liveUntil?: number }) {
  return (
    <div className="flow">
      {steps.map((s, i) => (
        <span key={s} style={{ display: 'contents' }}>
          {i > 0 && <span className="arrow">→</span>}
          <span className={`node ${liveUntil == null || i <= liveUntil ? 'live' : 'ghost'}`}>{s}</span>
        </span>
      ))}
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
            <strong>AbouAmjad Store</strong>
            <small>AICS operations</small>
          </div>
        </div>
        {['Dashboard', 'Terminal', 'Not returned', 'Receiving', 'People', 'Products', 'Warehouses', 'Projects', 'Roles'].map((n, i) => (
          <div key={n} className={`nav-item ${i === 0 ? 'on' : ''}`}>{n}</div>
        ))}
      </nav>
      <main>
        <div className="kpis">
          <div className="kpi"><span>In stock</span><strong>Live</strong></div>
          <div className="kpi"><span>Low stock</span><strong>Alerts</strong></div>
          <div className="kpi"><span>Outstanding</span><strong>Custody</strong></div>
          <div className="kpi"><span>Projects</span><strong>On site</strong></div>
        </div>
        <p className="lede" style={{ marginTop: 18, fontSize: 14 }}>
          Real product chrome — inventory dashboard, QR terminal, warehouses, projects, QC, timesheet, roles.
        </p>
      </main>
    </div>
  )
}
