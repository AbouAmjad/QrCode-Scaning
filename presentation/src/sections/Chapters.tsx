import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { LIVE } from '../data/story'
import { Dossier, Flow, OrgTree, Reveal, Sequence, Stagger, Tag } from '../components/Bits'

type P = { on: boolean }

export function Ch01({ on: _on }: P) {
  return (
    <div className="chapter dark-open">
      <Sequence
        gap={1.18}
        items={[
          'A delivery arrives.',
          'A tool is issued.',
          'A vehicle leaves.',
          'A team starts work.',
          'An inspection is performed.',
          'A safety issue is found.',
          'An engineer approves.',
          'A project moves forward.',
        ]}
      />
      <Reveal delay={10.4}>
        <h2 className="display wide" style={{ marginTop: '2.6rem' }}>
          Every operation creates information.
        </h2>
      </Reveal>
      <Reveal delay={12.8}>
        <p className="lede pause">But information alone isn’t enough.</p>
      </Reveal>
    </div>
  )
}

export function Ch02({ on: _on }: P) {
  const depts = ['Warehouse', 'Logistics', 'Site', 'Engineering', 'Quality', 'Safety', 'Management']
  const mess = ['Excel', 'Paper', 'WhatsApp', 'Separate systems', 'Manual approvals', 'Disconnected data']
  return (
    <div className="chapter">
      <div className="kicker">Chapter 02 · The invisible problem</div>
      <Stagger className="grid dept" step={0.08}>
        {depts.map((d) => (
          <div key={d} className="card">
            <h3>{d}</h3>
          </div>
        ))}
      </Stagger>
      <Stagger className="grid frag" step={0.1} delay={1.1}>
        {mess.map((d, i) => (
          <div
            key={d}
            className="card broken"
            style={{ ['--r' as string]: `${(i - 2.5) * 2.4}deg`, ['--x' as string]: `${(i % 3) * 6}px` }}
          >
            <h3>{d}</h3>
          </div>
        ))}
      </Stagger>
      <Reveal delay={2.2}>
        <h2 className="display wide" style={{ marginTop: '2rem' }}>
          When operations are disconnected, decisions become slower.
        </h2>
      </Reveal>
      <Reveal delay={3.6}>
        <p className="lede">Visibility disappears between departments.</p>
      </Reveal>
    </div>
  )
}

export function Ch03({ on: _on }: P) {
  return (
    <div className="chapter stack center">
      <Reveal>
        <h2 className="display center wide">What if every operation was connected?</h2>
      </Reveal>
      <Reveal delay={1.4} className="spine-wrap">
        <div className="spine">
          {['Warehouse', 'Logistics', 'Site', 'Engineering', 'Quality', 'Safety', 'Management', 'Executive'].map(
            (n) => (
              <div key={n} className="spine-node">
                {n}
              </div>
            ),
          )}
        </div>
      </Reveal>
      <Reveal delay={2.8}>
        <p className="subline">One digital operating environment.</p>
      </Reveal>
    </div>
  )
}

const MODULES = [
  'Inventory',
  'Logistics',
  'Projects',
  'Sites',
  'Engineering',
  'Quality',
  'Safety',
  'People',
  'Assets',
  'Management',
  'Analytics',
]

export function Ch04({ on: _on }: P) {
  return (
    <div className="chapter">
      <Reveal>
        <h2 className="display">One platform.</h2>
      </Reveal>
      <Reveal delay={0.7}>
        <p className="lede">The live AICS operating environment — not a mockup of a future product.</p>
        <div style={{ marginTop: 10 }}>
          <Tag kind="live">QR terminal, inventory, projects, QC, timesheet, roles</Tag>
        </div>
      </Reveal>
      <Reveal delay={1.1}>
        <div className="reveal-frame">
          <img src={`${import.meta.env.BASE_URL}ui-login-aics.png`} alt="Live AICS System login" />
        </div>
      </Reveal>
      <Stagger className="pills" step={0.09} delay={1.6}>
        {MODULES.map((m) => (
          <span key={m} className="pill">
            {m}
          </span>
        ))}
      </Stagger>
      <Reveal delay={2.8}>
        <p className="subline">All connected.</p>
      </Reveal>
    </div>
  )
}

const ASSET_STEPS = [
  {
    stage: 'Received',
    status: 'Received',
    person: 'Store keeper',
    location: 'Receiving dock',
    project: '—',
    time: '08:14',
    record: 'Receiving record',
  },
  {
    stage: 'Stored',
    status: 'In stock',
    person: 'Warehouse',
    location: 'Main store',
    project: '—',
    time: '08:31',
    record: 'Warehouse stock',
  },
  {
    stage: 'Issued',
    status: 'Out',
    person: 'Worker · P-code',
    location: 'Terminal',
    project: 'AICS-04',
    time: '09:02',
    record: 'QR scan OUT',
  },
  {
    stage: 'Assigned',
    status: 'In custody',
    person: 'Named holder',
    location: 'Leaving store',
    project: 'AICS-04',
    time: '09:03',
    record: 'Outstanding',
  },
  {
    stage: 'Moved',
    status: 'In transit',
    person: 'Logistics',
    location: 'Warehouse → site',
    project: 'AICS-04',
    time: '09:40',
    record: 'Project dispatch',
  },
  {
    stage: 'Used on site',
    status: 'On site',
    person: 'Site team',
    location: 'Project site',
    project: 'AICS-04',
    time: '10:15',
    record: 'Site stock',
  },
  {
    stage: 'Returned',
    status: 'Returned',
    person: 'Store keeper',
    location: 'Main store',
    project: 'AICS-04',
    time: '16:48',
    record: 'Terminal IN / return',
  },
  {
    stage: 'Inspected',
    status: 'QC checked',
    person: 'QC',
    location: 'Store / lab',
    project: '—',
    time: 'Next due',
    record: 'Calibration record',
  },
  {
    stage: 'Tracked',
    status: 'Traceable',
    person: 'Any authorized role',
    location: 'Anywhere it moved',
    project: 'AICS-04',
    time: 'Full history',
    record: 'Scan log · audit',
  },
]

export function Ch05({ on: _on }: P) {
  const [i, setI] = useState(0)
  const step = ASSET_STEPS[i]
  useLayoutEffect(() => {
    const id = window.setInterval(() => {
      setI((v) => (v + 1) % ASSET_STEPS.length)
    }, 1600)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="chapter">
      <div className="kicker">Chapter 05 · Follow one asset</div>
      <h2 className="display">Tool #1048</h2>
      <p className="lede">A representative asset. At every stage: status, person, location, project, time, record.</p>
      <Tag kind="live">Terminal · outstanding · receiving · project dispatch · QC</Tag>
      <div className="journey-live">
        <div className="journey-rail">
          {ASSET_STEPS.map((s, n) => (
            <button key={s.stage} className={n === i ? 'on' : ''} type="button" onClick={() => setI(n)}>
              {s.stage}
            </button>
          ))}
        </div>
        <Dossier
          status={step.status}
          person={step.person}
          location={step.location}
          project={step.project}
          time={step.time}
          record={step.record}
        />
      </div>
      <Reveal delay={0.4}>
        <div className="zoom-words">
          <span>One asset.</span>
          <span>One project.</span>
          <span>One company.</span>
        </div>
      </Reveal>
    </div>
  )
}

export function Ch06({ on: _on }: P) {
  return (
    <div className="chapter">
      <p className="lede">But an operation doesn’t stop at the warehouse.</p>
      <h2 className="display wide">Logistics connects the operation.</h2>
      <p className="subline" style={{ marginTop: 16 }}>
        The chain that exists today
      </p>
      <Flow
        liveUntil={4}
        steps={['Request', 'Receiving', 'Warehouse transfer', 'Project dispatch', 'Site arrival', 'Confirmation', 'Documentation', 'Tracking']}
      />
      <div style={{ marginTop: 18 }}>
        <Tag kind="live">Store request · receiving · transfer · dispatch · outstanding</Tag>
      </div>
      <p className="subline" style={{ marginTop: 22 }}>
        Planning, fleet assignment and GPS transport can be added as operating rules — they are not a separate GPS TMS today.
      </p>
      <Tag kind="concept">Planning · assignment · GPS transportation</Tag>
    </div>
  )
}

export function Ch07({ on: _on }: P) {
  return (
    <div className="chapter">
      <h2 className="display">The site.</h2>
      <p className="lede">Not just a location record. A digital operating environment.</p>
      <div className="site">
        <div className="site-col">
          <div>
            <b>Company</b> AICS
          </div>
          <div>
            ↓ <b>Project</b> <Tag kind="live">code, name, site</Tag>
          </div>
          <div>
            ↓ <b>Site</b> <Tag kind="live">dispatch / site stock</Tag>
          </div>
          <div>
            ↓ Area / location <Tag kind="concept">operating layers</Tag>
          </div>
        </div>
        <div className="site-live">
          <div className="pulse" />
          <div className="event">
            <b>Teams</b> people on the job
          </div>
          <div className="event">
            <b>Assets</b> tools in custody
          </div>
          <div className="event">
            <b>Materials</b> stock movement
          </div>
          <div className="event">
            <b>Activities</b> work in motion
          </div>
          <div className="event dim">
            <b>Inspections / issues</b> <Tag kind="concept">site HSE / QC loops</Tag>
          </div>
        </div>
      </div>
      <p className="subline" style={{ marginTop: 22 }}>
        The operation has a place.
      </p>
      <p className="lede">Now it has a digital context.</p>
    </div>
  )
}

export function Ch08({ on: _on }: P) {
  return (
    <div className="chapter">
      <h2 className="display wide">From activity to control.</h2>
      <p className="lede">Every decision has context — person, role, status, time, record.</p>
      <Tag kind="live">Engineer role · permissions · project access</Tag>
      <Flow steps={['Request', 'Engineer review', 'Approval', 'Execution', 'Verification']} liveUntil={-1} />
      <Dossier
        status="Pending approval"
        person="Engineer"
        location="Project AICS-04"
        project="AICS-04"
        time="Context stamped"
        record="Role + permission, not a separate app"
      />
      <p className="lede">The five-step routing is a customization pattern. Production already decides who can see and act.</p>
      <Tag kind="concept">Configurable engineering approval chain</Tag>
    </div>
  )
}

export function Ch09({ on: _on }: P) {
  return (
    <div className="chapter">
      <h2 className="display wide">Quality is not a checkbox.</h2>
      <Tag kind="live">QC calibration · overdue · due soon · product flags</Tag>
      <Flow steps={['Inspection', 'Finding', 'Corrective action', 'Assignment', 'Verification', 'Closure']} liveUntil={0} />
      <p className="lede" style={{ marginTop: 16 }}>
        Today quality is already tied to products, people and time. Inspection → finding → closure is how it extends into the full operation.
      </p>
      <div className="connect-row">
        <span>Project</span>
        <span>Site</span>
        <span>People</span>
        <span>Documents</span>
        <span>Responsible party</span>
      </div>
      <p className="subline" style={{ marginTop: 18 }}>
        Quality becomes part of the operation.
      </p>
      <Tag kind="concept">Finding · CAPA · closure workflow</Tag>
    </div>
  )
}

export function Ch10({ on: _on }: P) {
  return (
    <div className="chapter">
      <h2 className="display wide">Safety is part of the operation.</h2>
      <Tag kind="live">Safety role · damage reports · PPE per-SKU cooldown</Tag>
      <p className="lede">Not a separate application. People, site, project, engineering and management already share the same environment.</p>
      <Flow steps={['Inspection', 'Finding', 'Risk', 'Corrective action', 'Responsible person', 'Verification', 'Close']} liveUntil={-1} />
      <div className="connect-row">
        <span>People</span>
        <span>Site</span>
        <span>Project</span>
        <span>Engineering</span>
        <span>Management</span>
      </div>
      <Tag kind="concept">HSE inspection · risk register · verification loop</Tag>
    </div>
  )
}

export function Ch11({ on: _on }: P) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const labels = root.querySelectorAll('.org-node')
    const tl = gsap.timeline()
    gsap.set(labels, { opacity: 0, y: 10 })
    tl.to(labels, { opacity: 1, y: 0, stagger: 0.14, duration: 0.45, ease: 'power2.out' })
    tl.to(labels, { opacity: 0.12, duration: 0.8, ease: 'power2.inOut' }, '+=1.6')
    tl.fromTo('.hub-final', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.2')
    return () => {
      tl.kill()
    }
  }, [])
  return (
    <div className="chapter stack center" ref={ref}>
      <OrgTree />
      <p className="hub-final display center wide">One connected system.</p>
    </div>
  )
}

export function Ch12({ on: _on }: P) {
  return (
    <div className="chapter stack center">
      <Stagger className="pills center-pills" step={0.07}>
        {MODULES.map((m) => (
          <span key={m} className="pill">
            {m}
          </span>
        ))}
      </Stagger>
      <Reveal delay={1.6}>
        <h2 className="display center">But there is one more thing.</h2>
      </Reveal>
      <Reveal delay={3.3}>
        <p className="lede" style={{ textAlign: 'center', maxWidth: '22ch' }}>
          Your company doesn’t work like every other company.
        </p>
      </Reveal>
      <Reveal delay={5.1}>
        <h2 className="display center wide">So why should your software?</h2>
      </Reveal>
    </div>
  )
}

export function Ch13({ on: _on }: P) {
  return (
    <div className="chapter">
      <Tag kind="concept">Visual workflow builder — not in production yet</Tag>
      <h2 className="display">Create workflow</h2>
      <div className="wf" style={{ marginTop: 18 }}>
        <div className="box">Safety inspection</div>
        <div className="box">Engineer review</div>
        <div className="arrow-d">↓</div>
        <div className="box">Safety approval</div>
        <div className="arrow-d">↓</div>
        <div className="box">Manager approval</div>
        <div className="rules">
          Require photo · Require GPS · Require signature · Notify supervisor · Generate report
        </div>
        <div className="box publish">PUBLISH</div>
      </div>
      <p className="subline" style={{ marginTop: 20 }}>
        Your workflow. Your rules. Your system.
      </p>
      <p className="lede">Today the same philosophy is already live through roles, permissions, forms and operational rules.</p>
    </div>
  )
}

export function Ch14({ on: _on }: P) {
  return (
    <div className="chapter">
      <h2 className="display wide">Software that understands how your business works.</h2>
      <div className="rule">
        <div className="if">IF calibration expired</div>
        <span className="arrow">→</span>
        <div className="then">
          Surface on QC and product flags — issuance policy can be extended to block <Tag kind="live">calendar</Tag>
        </div>
      </div>
      <div className="rule">
        <div className="if">IF PPE re-issued inside cooldown</div>
        <span className="arrow">→</span>
        <div className="then">
          Warn / confirm on the terminal <Tag kind="live">per SKU</Tag>
        </div>
      </div>
      <div className="rule">
        <div className="if">IF role lacks permission</div>
        <span className="arrow">→</span>
        <div className="then">
          Page and action denied <Tag kind="live">matrix</Tag>
        </div>
      </div>
      <div className="rule">
        <div className="if">IF inspection failed / critical finding</div>
        <span className="arrow">→</span>
        <div className="then">
          Create corrective action / escalate <Tag kind="concept">extend</Tag>
        </div>
      </div>
      <div className="rule">
        <div className="if">IF approval required</div>
        <span className="arrow">→</span>
        <div className="then">
          Route to authorized role <Tag kind="live">permissions</Tag>
        </div>
      </div>
    </div>
  )
}

export function Ch15({ on: _on }: P) {
  const roles = [
    ['Admin', 'System, users, roles'],
    ['Engineer', 'Field access, project work'],
    ['QC', 'Calibration, quality flags'],
    ['Safety', 'Damage, PPE context'],
    ['Store', 'Terminal, receiving, custody'],
    ['Supervisor', 'Scoped operational view'],
    ['Management', 'Dashboard, audit'],
    ['Executive', 'The picture, not the noise'],
  ]
  return (
    <div className="chapter">
      <h2 className="display wide">One platform. Different experiences.</h2>
      <Tag kind="live">17 roles · permission matrix · warehouse & project scopes</Tag>
      <p className="lede">Access, dashboards, actions, permissions, approval authority — by role.</p>
      <Stagger className="grid roles" step={0.07} delay={0.2}>
        {roles.map(([a, b]) => (
          <div key={a} className="card">
            <h3>{a}</h3>
            <p>{b}</p>
          </div>
        ))}
      </Stagger>
    </div>
  )
}

export function Ch16({ on: _on }: P) {
  const lv = [
    ['Worker', 'An asset.'],
    ['Logistics', 'A movement.'],
    ['Engineer', 'A project activity.'],
    ['QC', 'A quality status.'],
    ['Safety', 'A risk.'],
    ['Management', 'Performance.'],
    ['CEO', 'The big picture.'],
  ]
  return (
    <div className="chapter">
      <Stagger className="levels" step={0.16}>
        {lv.map(([w, s], i) => (
          <div key={w} className="lvl" style={{ ['--s' as string]: String(1 + i * 0.04) }}>
            <div className="who">{w} sees</div>
            <div className="see">{s}</div>
          </div>
        ))}
      </Stagger>
    </div>
  )
}

export function Ch17({ on: _on }: P) {
  return (
    <div className="chapter">
      <h2 className="display wide">From thousands of operations…</h2>
      <Reveal delay={1.5}>
        <p className="lede pause">…to the few decisions that matter.</p>
      </Reveal>
      <Tag kind="live">Inventory dashboard — stock, value, alerts, movement</Tag>
      <div className="kpis exec" style={{ marginTop: 18 }}>
        <div className="kpi">
          <span>Inventory</span>
          <strong>Exposure</strong>
        </div>
        <div className="kpi">
          <span>Outstanding</span>
          <strong>Actions</strong>
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
      <p className="lede">The CEO should not see operational noise. Project, safety and logistics packs compose from the same thread.</p>
      <Tag kind="concept">Executive KPI pack</Tag>
    </div>
  )
}

export function Ch18({ on: _on }: P) {
  return (
    <div className="chapter stack center">
      <h2 className="display center">One digital thread.</h2>
      <Reveal delay={0.5}>
        <Flow
          steps={['Supplier', 'Warehouse', 'Logistics', 'Project', 'Engineer', 'QC', 'Safety', 'Management', 'CEO']}
        />
      </Reveal>
      <p className="lede" style={{ textAlign: 'center' }}>
        Every operational event contributes to organizational visibility.
      </p>
    </div>
  )
}

export function Ch19({ on: _on }: P) {
  return (
    <div className="chapter stack center">
      <h2 className="display center">One web application.</h2>
      <p className="lede" style={{ textAlign: 'center' }}>
        Runs in the browser on desktop, laptop and tablet. No extra client install.
      </p>
      <div className="devices">
        <div className="device desk">
          <div className="screen real" />
          <small>Desktop</small>
        </div>
        <div className="device lap">
          <div className="screen" />
          <small>Laptop</small>
        </div>
        <div className="device tab">
          <div className="screen" />
          <small>Tablet</small>
        </div>
      </div>
      <p className="subline" style={{ marginTop: 22 }}>
        No fragmented tools.
      </p>
      <a className="tag live" href={LIVE} style={{ textDecoration: 'none', marginTop: 12 }}>
        Open live system
      </a>
    </div>
  )
}

export function Ch20({ on: _on }: P) {
  const blocks = ['New workflow', 'New department', 'New project', 'New business rule', 'New dashboard', 'New integration']
  return (
    <div className="chapter">
      <h2 className="display wide">And it doesn’t stop here.</h2>
      <Stagger className="grid blocks" step={0.1} delay={0.3}>
        {blocks.map((b) => (
          <div key={b} className="card block">
            <h3>{b}</h3>
          </div>
        ))}
      </Stagger>
      <p className="subline" style={{ marginTop: 22 }}>
        The platform evolves with the business.
      </p>
    </div>
  )
}

export function Ch21({ on: _on }: P) {
  return (
    <div className="chapter stack center finale">
      <Sequence
        gap={1.25}
        items={['One tool.', 'One warehouse.', 'One site.', 'One project.', 'Multiple projects.', 'The company.', 'Executive view.']}
      />
      <Reveal delay={9.4}>
        <h2 className="display center wide" style={{ marginTop: '2.2rem' }}>
          From the warehouse to the CEO.
        </h2>
      </Reveal>
      <Reveal delay={11}>
        <p className="subline">Every operation. Connected.</p>
      </Reveal>
      <Reveal delay={12.5}>
        <p className="lede" style={{ textAlign: 'center' }}>
          Your business is unique. Your software should be too.
        </p>
      </Reveal>
      <Reveal delay={14}>
        <h2 className="display center wide closer">Fully customizable web application</h2>
        <p className="lede" style={{ textAlign: 'center' }}>
          Designed around your workflows.
          <br />
          Built around your business.
          <br />
          Ready to evolve with you.
        </p>
      </Reveal>
    </div>
  )
}

export const VIEWS = [
  Ch01,
  Ch02,
  Ch03,
  Ch04,
  Ch05,
  Ch06,
  Ch07,
  Ch08,
  Ch09,
  Ch10,
  Ch11,
  Ch12,
  Ch13,
  Ch14,
  Ch15,
  Ch16,
  Ch17,
  Ch18,
  Ch19,
  Ch20,
  Ch21,
]
