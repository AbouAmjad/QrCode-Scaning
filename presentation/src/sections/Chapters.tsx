import { LIVE } from '../data/story'
import { Flow, Lines, ProductShell, Tag } from '../components/Bits'

type P = { on: boolean }

export function Ch01({ on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 01 · The real world</div>
      <Lines
        on={on}
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
      <h2 className="display" style={{ marginTop: '2.4rem' }}>Every operation creates information.</h2>
      <p className="lede">But information alone isn’t enough.</p>
    </div>
  )
}

export function Ch02({ on: _on }: P) {
  const depts = ['Warehouse', 'Logistics', 'Site', 'Engineering', 'Quality', 'Safety', 'Management']
  const mess = ['Excel', 'Paper', 'WhatsApp', 'Separate systems', 'Manual approvals', 'Disconnected data']
  return (
    <div className="chapter">
      <div className="kicker">Chapter 02 · The invisible problem</div>
      <div className="grid dept">
        {depts.map((d) => (
          <div key={d} className="card"><h3>{d}</h3></div>
        ))}
      </div>
      <div className="grid frag">
        {mess.map((d, i) => (
          <div key={d} className="card broken" style={{ ['--r' as string]: `${(i - 2.5) * 2.2}deg`, ['--x' as string]: `${(i % 3) * 4}px` }}>
            <h3>{d}</h3>
          </div>
        ))}
      </div>
      <h2 className="display wide" style={{ marginTop: '2rem' }}>When operations are disconnected, decisions become slower.</h2>
      <p className="lede">Visibility disappears between departments.</p>
    </div>
  )
}

export function Ch03({ on: _on }: P) {
  return (
    <div className="chapter stack center">
      <div className="kicker">Chapter 03 · The question</div>
      <h2 className="display center">What if every operation was connected?</h2>
      <Flow
        steps={['Warehouse', 'Logistics', 'Site', 'Engineering', 'Quality', 'Safety', 'Management', 'Executive']}
      />
      <p className="subline" style={{ marginTop: '2rem' }}>One digital operating environment.</p>
    </div>
  )
}

export function Ch04({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 04 · The reveal</div>
      <h2 className="display">One platform.</h2>
      <p className="lede">AbouAmjad Store System — already running for AICS operations.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <Tag kind="live">QR terminal, inventory, projects, QC, timesheet, roles</Tag>
      </div>
      <ProductShell />
      <Flow
        steps={['Inventory', 'Logistics', 'Projects', 'Sites', 'People', 'Assets', 'Quality', 'Management']}
      />
      <p className="subline" style={{ marginTop: 18 }}>All connected — where the work already lives.</p>
    </div>
  )
}

export function Ch05({ on: _on }: P) {
  const rows = [
    ['Received', 'Receiving record · store keeper · warehouse'],
    ['Stored', 'Location on warehouse stock'],
    ['Issued', 'QR terminal OUT · person code P…'],
    ['Assigned', 'Worker / subcontractor custody'],
    ['On site', 'Project dispatch · site stock'],
    ['Returned', 'Terminal IN or project return'],
    ['Inspected', 'QC calibration where required'],
    ['Tracked', 'Scan log · outstanding · audit'],
  ]
  return (
    <div className="chapter">
      <div className="kicker">Chapter 05 · Follow one asset</div>
      <h2 className="display">Tool I17-A</h2>
      <p className="lede">A representative catalog item. Status, person, location, project and time attach to each movement.</p>
      <Tag kind="live">Terminal · outstanding · receiving · project dispatch · QC</Tag>
      <div className="journey">
        {rows.map(([a, b]) => (
          <div key={a} className="contents-row" style={{ display: 'contents' }}>
            <div className="step">{a}</div>
            <div className="meta"><strong>{a}.</strong> {b}</div>
          </div>
        ))}
      </div>
      <p className="subline" style={{ marginTop: 22 }}>One asset. One project. One company. Traceable.</p>
    </div>
  )
}

export function Ch06({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 06 · Logistics</div>
      <p className="lede">But an operation doesn’t stop at the warehouse.</p>
      <h2 className="display wide">Logistics connects the operation.</h2>
      <p className="subline" style={{ marginTop: 12 }}>The chain that exists today</p>
      <Flow liveUntil={5} steps={['Store request', 'Receiving', 'Warehouse transfer', 'Project dispatch', 'Site stock', 'Return / outstanding']} />
      <p className="subline" style={{ marginTop: 22 }}>Configurable extensions</p>
      <Tag kind="concept">Planning · fleet assignment · GPS transport tracking</Tag>
      <Flow liveUntil={-1} steps={['Planning', 'Assignment', 'Transportation', 'GPS arrival']} />
    </div>
  )
}

export function Ch07({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 07 · The site</div>
      <h2 className="display">The site.</h2>
      <p className="lede">The operation has a place. Now it has a digital context.</p>
      <div className="tree">
        <div><b>Company</b> — AICS</div>
        <div>↓ <b>Project</b> <Tag kind="live">code, name, site</Tag></div>
        <div>↓ <b>Site stock</b> <Tag kind="live">dispatch / return</Tag></div>
        <div>↓ Area / teams / inspections <Tag kind="concept">site operating layers</Tag></div>
      </div>
    </div>
  )
}

export function Ch08({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 08 · Engineering</div>
      <h2 className="display wide">From activity to control.</h2>
      <p className="lede">Every decision has context — person, role, status, time, record.</p>
      <Tag kind="live">Engineer role · permissions · consumables · project access</Tag>
      <Flow steps={['Request', 'Engineer review', 'Approval', 'Execution', 'Verification']} liveUntil={-1} />
      <p className="lede">The routing above is a customization pattern. Production already separates who can see and act.</p>
    </div>
  )
}

export function Ch09({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 09 · Quality</div>
      <h2 className="display wide">Quality is not a checkbox.</h2>
      <Tag kind="live">QC calibration · overdue · due soon · product flags</Tag>
      <Flow steps={['Calibration due', 'Record calibration', 'Next due', 'Block or alert']} liveUntil={3} />
      <p className="lede" style={{ marginTop: 18 }}>Inspection → finding → CAPA is how the platform can extend quality into the operation.</p>
      <Tag kind="concept">Finding · corrective action · closure workflow</Tag>
    </div>
  )
}

export function Ch10({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 10 · Safety</div>
      <h2 className="display wide">Safety is part of the operation.</h2>
      <Tag kind="live">Safety role · damage reports · PPE re-issue cooldown</Tag>
      <p className="lede">Gloves and glasses are controlled per SKU. Damage is a store record, not a separate universe.</p>
      <Tag kind="concept">HSE inspection · risk register · verification loop</Tag>
      <Flow liveUntil={-1} steps={['Inspection', 'Finding', 'Risk', 'Corrective action', 'Verification', 'Close']} />
    </div>
  )
}

export function Ch11({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 11 · The connection</div>
      <div className="net">
        <div className="card"><h3>Inventory</h3><p>Stock, receiving, custody</p></div>
        <div className="card"><h3>Logistics</h3><p>Transfer · dispatch</p></div>
        <div className="card"><h3>Project / Site</h3><p>On-site tools</p></div>
        <div className="card"><h3>Engineering</h3><p>Role + access</p></div>
        <div className="hub">ONE CONNECTED SYSTEM</div>
        <div className="card"><h3>QC</h3><p>Calibration</p></div>
        <div className="card"><h3>Safety</h3><p>PPE · damage</p></div>
        <div className="card"><h3>Management</h3><p>Dashboard · audit</p></div>
        <div className="card"><h3>CEO</h3><p>The picture</p></div>
      </div>
    </div>
  )
}

export function Ch12({ on: _on }: P) {
  return (
    <div className="chapter stack center">
      <div className="kicker">Chapter 12 · The differentiator</div>
      <h2 className="display center">But there is one more thing.</h2>
      <p className="lede" style={{ textAlign: 'center' }}>Your company doesn’t work like every other company.</p>
      <h2 className="display center wide">So why should your software?</h2>
    </div>
  )
}

export function Ch13({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 13 · Full customization</div>
      <Tag kind="concept">Visual workflow builder — not in production yet</Tag>
      <h2 className="display">Create workflow</h2>
      <div className="wf" style={{ marginTop: 16 }}>
        <div className="box">Safety inspection</div>
        <div className="box">Engineer review → Safety approval → Manager approval</div>
        <div className="box">Require photo · GPS · signature · notify supervisor · report</div>
        <div className="box publish">PUBLISH</div>
      </div>
      <p className="subline" style={{ marginTop: 20 }}>Your workflow. Your rules. Your system.</p>
      <p className="lede">Today this is configured through roles, permissions, forms and operational rules — the same philosophy, already live.</p>
    </div>
  )
}

export function Ch14({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 14 · Business rules</div>
      <h2 className="display wide">Software that understands how your business works.</h2>
      <div className="rule">
        <div className="if">IF PPE re-issued inside cooldown</div>
        <span className="arrow">→</span>
        <div className="then">WARN / confirm on terminal <Tag kind="live">per SKU</Tag></div>
      </div>
      <div className="rule">
        <div className="if">IF calibration expired</div>
        <span className="arrow">→</span>
        <div className="then">Surface on QC + product flags <Tag kind="live">calendar</Tag></div>
      </div>
      <div className="rule">
        <div className="if">IF role lacks permission</div>
        <span className="arrow">→</span>
        <div className="then">Page and action denied <Tag kind="live">matrix</Tag></div>
      </div>
      <div className="rule">
        <div className="if">IF inspection failed</div>
        <span className="arrow">→</span>
        <div className="then">Create corrective action <Tag kind="concept">extend</Tag></div>
      </div>
    </div>
  )
}

export function Ch15({ on: _on }: P) {
  const roles = [
    ['Store keeper', 'Terminal, receiving, outstanding'],
    ['Logistics', 'Projects, forms, movement'],
    ['Material controller', 'Stock control'],
    ['QC', 'Calibration'],
    ['Engineer', 'Field / consumables'],
    ['Safety', 'Damage, PPE context'],
    ['Management', 'Dashboard, audit'],
    ['Admin', 'Users, roles, system'],
  ]
  return (
    <div className="chapter">
      <div className="kicker">Chapter 15 · Roles & permissions</div>
      <h2 className="display wide">One platform. Different experiences.</h2>
      <Tag kind="live">17 roles · permission matrix · warehouse & project scopes</Tag>
      <div className="grid roles" style={{ marginTop: 18 }}>
        {roles.map(([a, b]) => (
          <div key={a} className="card"><h3>{a}</h3><p>{b}</p></div>
        ))}
      </div>
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
      <div className="kicker">Chapter 16 · From operations to management</div>
      <div className="levels">
        {lv.map(([w, s]) => (
          <div key={w} className="lvl"><div className="who">{w}</div><div className="see">{s}</div></div>
        ))}
      </div>
    </div>
  )
}

export function Ch17({ on: _on }: P) {
  return (
    <div className="chapter">
      <div className="kicker">Chapter 17 · CEO / Executive</div>
      <h2 className="display wide">From thousands of operations…</h2>
      <p className="lede">…to the few decisions that matter.</p>
      <Tag kind="live">Inventory dashboard — stock, value, alerts, movement</Tag>
      <div className="kpis" style={{ marginTop: 18 }}>
        <div className="kpi"><span>Inventory</span><strong>Exposure</strong></div>
        <div className="kpi"><span>Outstanding</span><strong>Actions</strong></div>
        <div className="kpi"><span>Quality</span><strong>Due / overdue</strong></div>
        <div className="kpi"><span>Projects</span><strong>On site</strong></div>
      </div>
      <p className="lede">Project, safety and logistics executive packs are how the same data can be composed for the CEO — without operational noise.</p>
      <Tag kind="concept">Executive KPI pack</Tag>
    </div>
  )
}

export function Ch18({ on: _on }: P) {
  return (
    <div className="chapter stack center">
      <div className="kicker">Chapter 18 · The digital thread</div>
      <h2 className="display center">One digital thread.</h2>
      <Flow steps={['Supplier', 'Warehouse', 'Logistics', 'Project', 'Engineer', 'QC', 'Safety', 'Management', 'CEO']} />
      <p className="lede" style={{ textAlign: 'center' }}>Every operational event can contribute to organizational visibility.</p>
    </div>
  )
}

export function Ch19({ on: _on }: P) {
  return (
    <div className="chapter stack center">
      <div className="kicker">Chapter 19 · Web application</div>
      <h2 className="display center">One web application.</h2>
      <p className="lede" style={{ textAlign: 'center' }}>Runs in the browser — desktop, laptop, tablet. No extra client install.</p>
      <div className="devices">
        <div className="device desk"><div className="screen" /></div>
        <div className="device lap"><div className="screen" /></div>
        <div className="device tab"><div className="screen" /></div>
      </div>
      <p className="subline" style={{ marginTop: 22 }}>No fragmented tools for the core operation.</p>
      <a className="tag live" href={LIVE} style={{ textDecoration: 'none', marginTop: 12 }}>Open live system</a>
    </div>
  )
}

export function Ch20({ on: _on }: P) {
  const blocks = ['New workflow', 'New department', 'New project', 'New business rule', 'New dashboard', 'New integration']
  return (
    <div className="chapter">
      <div className="kicker">Chapter 20 · The platform evolves</div>
      <h2 className="display wide">And it doesn’t stop here.</h2>
      <div className="grid blocks" style={{ marginTop: 20 }}>
        {blocks.map((b) => (
          <div key={b} className="card"><h3>{b}</h3></div>
        ))}
      </div>
      <p className="subline" style={{ marginTop: 22 }}>The platform evolves with the business.</p>
    </div>
  )
}

export function Ch21({ on }: P) {
  return (
    <div className="chapter stack center">
      <div className="kicker">Chapter 21 · The final zoom</div>
      <Lines
        on={on}
        items={['One tool.', 'One warehouse.', 'One site.', 'One project.', 'The company.', 'Executive view.']}
      />
      <h2 className="display center wide" style={{ marginTop: '2.2rem' }}>From the warehouse to the CEO.</h2>
      <p className="subline">Every operation. Connected.</p>
      <p className="lede" style={{ textAlign: 'center' }}>Your business is unique. Your software should be too.</p>
      <h2 className="display center wide" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', marginTop: '1.4rem' }}>Fully customizable web application</h2>
      <p className="lede" style={{ textAlign: 'center' }}>Designed around your workflows. Built around your business. Ready to evolve with you.</p>
    </div>
  )
}

export const VIEWS = [
  Ch01, Ch02, Ch03, Ch04, Ch05, Ch06, Ch07, Ch08, Ch09, Ch10,
  Ch11, Ch12, Ch13, Ch14, Ch15, Ch16, Ch17, Ch18, Ch19, Ch20, Ch21,
]
