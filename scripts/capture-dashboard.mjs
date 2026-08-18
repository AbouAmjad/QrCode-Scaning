#!/usr/bin/env node
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'presentation/public/ui-dashboard-aics.png')

const mockDashboard = {
  categories: ['Tools', 'Consumables', 'PPE', 'Electrical', 'Mechanical'],
  kpis: {
    totalProducts: 1842,
    inStock: 1567,
    lowStock: 198,
    outOfStock: 77,
    inventoryValue: 2847650,
    suppliers: 42,
    ordersToday: 6,
  },
  movement: Array.from({ length: 14 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    stockIn: 18 + (i % 5) * 4,
    stockOut: 12 + (i % 4) * 3,
  })),
  monthly: [
    { month: 'Mar', stockIn: 420, stockOut: 380 },
    { month: 'Apr', stockIn: 510, stockOut: 445 },
    { month: 'May', stockIn: 480, stockOut: 502 },
    { month: 'Jun', stockIn: 620, stockOut: 590 },
    { month: 'Jul', stockIn: 580, stockOut: 610 },
    { month: 'Aug', stockIn: 340, stockOut: 298 },
  ],
  byCategory: [
    { category: 'Tools', products: 520 },
    { category: 'Consumables', products: 410 },
    { category: 'PPE', products: 280 },
    { category: 'Electrical', products: 190 },
    { category: 'Mechanical', products: 442 },
  ],
  topConsumed: [
    { code: 'C12-A', qty: 840 },
    { code: 'C08-B', qty: 620 },
    { code: 'C15', qty: 510 },
    { code: 'C03', qty: 480 },
    { code: 'C21-X', qty: 390 },
  ],
  alerts: {
    reorder: [
      { code: 'I-4421', description: 'Torque wrench 1/2"', available: 0, minStock: 3, status: 'out' },
      { code: 'C12-A', description: 'Welding gloves', available: 12, minStock: 40, status: 'low' },
    ],
    pendingRequests: [{ id: 1184, byUser: 'Ahmed K.', note: 'Site B consumables', status: 'pending' }],
    stagnant: [],
    expiring: [{ code: 'E-901', description: 'Pressure gauge', daysLeft: 14 }],
  },
  tables: {
    reorderList: [
      { code: 'I-4421', description: 'Torque wrench 1/2"', available: 0, minStock: 3, status: 'out' },
      { code: 'C12-A', description: 'Welding gloves', available: 12, minStock: 40, status: 'low' },
      { code: 'B-220', description: 'Safety harness L', available: 2, minStock: 8, status: 'low' },
    ],
    recentProducts: [
      { code: 'C88-NEW', description: 'Cutting disc 4"', available: 120, category: 'Consumables' },
      { code: 'I-9901', description: 'Impact socket set', available: 6, category: 'Tools' },
    ],
    recentActivities: [
      { date: '2026-08-17T09:14:00', code: 'C12-A', action: 'OUT', qty: 4 },
      { date: '2026-08-17T08:52:00', code: 'I-2200', action: 'IN', qty: 1 },
    ],
    recentReceiving: [
      { date: '2026-08-16T14:20:00', code: 'C08-B', qty: 200, supplier: 'Gulf Safety' },
    ],
    recentRequests: [
      { id: 1184, byUser: 'Ahmed K.', status: 'pending', note: 'Site B consumables' },
    ],
  },
}

function mime(p) {
  if (p.endsWith('.html')) return 'text/html; charset=utf-8'
  if (p.endsWith('.css')) return 'text/css; charset=utf-8'
  if (p.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname === '/api') {
    const action = url.searchParams.get('action') || ''
    let body = mockDashboard
    if (action === 'getMyPermissions') {
      body = { permissions: ['*'], role: 'ceo', success: true }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
    return
  }
  let rel = decodeURIComponent(url.pathname)
  if (rel === '/') rel = '/dashboard.html'
  const file = path.join(root, rel.replace(/^\//, ''))
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  res.writeHead(200, { 'Content-Type': mime(file) })
  fs.createReadStream(file).pipe(res)
})

const port = await new Promise((resolve, reject) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  server.on('error', reject)
})

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 })

await page.evaluateOnNewDocument(() => {
  localStorage.setItem('token', 'demo-screenshot-token')
  localStorage.setItem('tc_role', 'ceo')
  localStorage.setItem('tc_user', 'ceo')
  localStorage.setItem('tc_fullname', 'Executive View')
  localStorage.setItem('tc_permissions', JSON.stringify(['*']))
  localStorage.setItem('uiTheme', 'aics')
  document.documentElement.setAttribute('data-theme', 'aics')
  document.documentElement.classList.add('theme-dark')
})

await page.goto(`http://127.0.0.1:${port}/dashboard.html`, { waitUntil: 'networkidle0', timeout: 60000 })
await page.waitForSelector('#mainContent', { visible: true, timeout: 30000 })
await page.waitForFunction(() => document.getElementById('kTotal')?.textContent !== '0', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 1200))

await page.screenshot({ path: out, type: 'png', fullPage: false })
console.log('Saved', out)

await browser.close()
server.close()
