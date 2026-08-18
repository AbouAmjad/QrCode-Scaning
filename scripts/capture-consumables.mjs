#!/usr/bin/env node
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'presentation/public/ui-consumables-aics.png')

const dates = [
  '17/08/2026', '16/08/2026', '15/08/2026', '12/08/2026', '08/08/2026',
  '29/07/2026', '22/07/2026', '18/07/2026', '11/07/2026',
  '28/06/2026', '14/06/2026',
]

const historyRows = [
  { toolCode: 'P04', toolDescription: 'Ahmed Khalid', rowDate: '17/08/2026', timestamp: '17/08/2026 08:14:22' },
  { toolCode: 'OUT', toolDescription: '', rowDate: '17/08/2026', timestamp: '17/08/2026 08:14:25' },
  { toolCode: 'C12-A', toolDescription: 'Welding gloves', rowDate: '17/08/2026', timestamp: '17/08/2026 08:14:31' },
  { toolCode: 'C08-B', toolDescription: 'Cutting disc 4"', rowDate: '17/08/2026', timestamp: '17/08/2026 08:14:40' },
  { toolCode: 'P11', toolDescription: 'Omar Saleh', rowDate: '17/08/2026', timestamp: '17/08/2026 09:02:10' },
  { toolCode: 'OUT', toolDescription: '', rowDate: '17/08/2026', timestamp: '17/08/2026 09:02:12' },
  { toolCode: 'C15', toolDescription: 'Cable ties 300mm', rowDate: '17/08/2026', timestamp: '17/08/2026 09:02:18' },
  { toolCode: 'C03', toolDescription: 'Duct tape 50mm', rowDate: '17/08/2026', timestamp: '17/08/2026 09:02:24' },
  { toolCode: 'C21-X', toolDescription: 'Marker pen black', rowDate: '17/08/2026', timestamp: '17/08/2026 09:02:31' },
  { toolCode: 'P07', toolDescription: 'Hassan Ali', rowDate: '16/08/2026', timestamp: '16/08/2026 14:20:01' },
  { toolCode: 'OUT', toolDescription: '', rowDate: '16/08/2026', timestamp: '16/08/2026 14:20:04' },
  { toolCode: 'C12-A', toolDescription: 'Welding gloves', rowDate: '16/08/2026', timestamp: '16/08/2026 14:20:11' },
  { toolCode: 'C88-NEW', toolDescription: 'Cutting disc 4"', rowDate: '16/08/2026', timestamp: '16/08/2026 14:20:19' },
]

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
    let body
    if (action === 'getMyPermissions') body = { permissions: ['*'], role: 'engineer', success: true }
    else if (action === 'getDates') body = dates
    else if (action === 'getData') body = historyRows
    else body = { ok: true }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
    return
  }
  let rel = decodeURIComponent(url.pathname)
  if (rel === '/') rel = '/consumables.html'
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
  localStorage.setItem('tc_role', 'engineer')
  localStorage.setItem('tc_user', 'engineer')
  localStorage.setItem('tc_fullname', 'Field Engineer')
  localStorage.setItem('tc_permissions', JSON.stringify(['*']))
  localStorage.setItem('uiTheme', 'aics')
  document.documentElement.setAttribute('data-theme', 'aics')
  document.documentElement.classList.add('theme-dark')
})

await page.goto(`http://127.0.0.1:${port}/consumables.html`, { waitUntil: 'networkidle0', timeout: 60000 })
await page.waitForSelector('#previewBody', { timeout: 30000 })
await page.waitForFunction(() => {
  const n = document.getElementById('statRows')?.textContent
  return n && n !== '0'
}, { timeout: 20000 })
await new Promise((r) => setTimeout(r, 900))

await page.screenshot({ path: out, type: 'png', fullPage: false })
console.log('Saved', out)

await browser.close()
server.close()
