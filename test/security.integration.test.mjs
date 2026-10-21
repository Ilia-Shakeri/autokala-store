import test from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createApp } from '../server/app.mjs'
import { hashPassword } from '../server/auth.mjs'

async function fixture(t, options = {}) {
  const app = createApp({ dbPath: ':memory:', logger: { error() {} }, ...options })
  await new Promise(done => app.server.listen(0, '127.0.0.1', done))
  t.after(() => app.close())
  const port = app.server.address().port
  function request(path, { host = `127.0.0.1:${port}`, method = 'GET', data, headers = {} } = {}) {
    return new Promise((done, reject) => {
      const bytes = data === undefined ? undefined : Buffer.from(JSON.stringify(data))
      const req = httpRequest({ hostname: '127.0.0.1', port, path, method, headers: { Host: host, ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {}), ...headers } }, res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => { const text = Buffer.concat(chunks).toString(); done({ status: res.statusCode, headers: res.headers, data: text ? (/application\/json/.test(res.headers['content-type']) ? JSON.parse(text) : text) : null }) })
        res.on('error', reject)
      })
      req.setTimeout(10000, () => req.destroy(new Error('HTTP test timeout')))
      req.on('error', reject)
      req.end(bytes)
    })
  }
  const credentials = { email: `admin-${randomUUID()}@example.test`, password: `test-${randomUUID()}` }
  app.store.db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run('مدیر آزمون', credentials.email, await hashPassword(credentials.password), 'admin', new Date().toISOString())
  return { ...app, port, request, credentials, adminHost: `localhost:${port}` }
}

test('admin pages and API stay absent on public host; only admin host accepts an admin login', async t => {
  const f = await fixture(t)
  for (const path of ['/admin', '/admin/orders', '/%61dmin', '/api/admin', '/api/admin/overview']) assert.equal((await f.request(path, { headers: { Accept: 'text/html' } })).status, 404, path)
  const blocked = await f.request('/api/auth/login', { method: 'POST', data: f.credentials })
  assert.equal(blocked.status, 401)
  assert.equal(blocked.headers['set-cookie'], undefined)
  const context = await f.request('/api/context')
  assert.equal(context.status, 200)
  assert.equal(context.data.isAdminHost, false)
  assert.equal('adminOrigin' in context.data, false)
  const login = await f.request('/api/auth/login', { host: f.adminHost, method: 'POST', data: f.credentials })
  assert.equal(login.status, 200)
  const cookie = login.headers['set-cookie'][0].split(';')[0]
  assert.match(cookie, /^autokala_admin_session=/)
  assert.equal(/Domain=/i.test(login.headers['set-cookie'][0]), false)
  assert.equal((await f.request('/api/admin/overview', { host: f.adminHost, headers: { Cookie: cookie } })).status, 200)
  assert.equal((await f.request('/api/session', { headers: { Cookie: cookie } })).data.user, null)
  assert.equal((await f.request('/api/admin/overview', { headers: { Cookie: cookie } })).status, 404)
  assert.equal((await f.request('/api/session', { headers: { Cookie: cookie.replace('autokala_admin_session=', 'autokala_session=') } })).data.user, null)
  assert.equal((await f.request('/api/context', { host: f.adminHost })).data.isAdminHost, true)
})

test('customers cannot sign in or register on the admin host; copied customer cookies cannot authorize it', async t => {
  const f = await fixture(t)
  const data = { name: 'خریدار آزمون', email: 'customer@example.test', password: `test-${randomUUID()}`, role: 'admin' }
  assert.equal((await f.request('/api/auth/register', { host: f.adminHost, method: 'POST', data })).status, 404)
  const registered = await f.request('/api/auth/register', { method: 'POST', data })
  assert.equal(registered.status, 201)
  assert.equal(registered.data.user.role, 'customer')
  const cookie = registered.headers['set-cookie'][0].split(';')[0]
  assert.equal((await f.request('/api/auth/login', { host: f.adminHost, method: 'POST', data })).status, 401)
  assert.equal((await f.request('/api/admin/overview', { host: f.adminHost, headers: { Cookie: cookie } })).status, 401)
  assert.equal((await f.request('/api/session', { host: f.adminHost, headers: { Cookie: cookie.replace('autokala_session=', 'autokala_admin_session=') } })).data.user, null)
})

test('unknown hosts and forwarded-host spoofing cannot select the admin surface', async t => {
  const f = await fixture(t, { trustProxy: true })
  for (const host of ['wrong.example.test', 'localhost.attacker.test', '127.0.0.1.attacker.test', 'localhost.', 'localhost:0']) assert.equal((await f.request('/api/context', { host })).status, 421, host)
  const spoofed = await f.request('/api/admin/overview', { headers: { 'X-Forwarded-Host': f.adminHost } })
  assert.equal(spoofed.status, 404)
  const context = await f.request('/api/context', { headers: { 'X-Forwarded-Host': f.adminHost } })
  assert.equal(context.data.isAdminHost, false)
})

test('admin writes require its own origin even when another origin is allowed for the shop', async t => {
  const f = await fixture(t, { allowedOrigins: ['https://shop.example.test'] })
  const login = await f.request('/api/auth/login', { host: f.adminHost, method: 'POST', data: f.credentials })
  assert.equal(login.status, 200)
  const cookie = login.headers['set-cookie'][0].split(';')[0]
  assert.equal((await f.request('/api/admin/settings', { host: f.adminHost, method: 'PATCH', data: { shippingFee: 30000 }, headers: { Cookie: cookie, Origin: 'https://shop.example.test' } })).status, 403)
  assert.equal((await f.request('/api/admin/settings', { host: f.adminHost, method: 'PATCH', data: { shippingFee: 30000 }, headers: { Cookie: cookie, Origin: `http://${f.adminHost}` } })).status, 200)
  assert.equal((await f.request('/api/session', { host: f.adminHost, headers: { Cookie: `${cookie}; ${cookie}` } })).data.user, null)
  assert.equal((await f.request('/api/auth/logout', { host: f.adminHost, method: 'POST', data: {}, headers: { Cookie: cookie } })).status, 200)
  assert.equal((await f.request('/api/admin/overview', { host: f.adminHost, headers: { Cookie: cookie } })).status, 401)
})

test('production fails closed until distinct DNS hosts and secure cookies are configured', async t => {
  for (const options of [
    { production: true },
    { production: true, publicHost: 'shop.example.test', adminHost: 'shop.example.test', secureCookies: true },
    { production: true, publicHost: 'shop.example.test', adminHost: 'admin.shop.example.test', secureCookies: false },
    { production: true, publicHost: '127.0.0.1', adminHost: 'localhost', secureCookies: true },
  ]) assert.throws(() => createApp({ dbPath: ':memory:', ...options }))
  const f = await fixture(t, { production: true, publicHost: 'shop.example.test', adminHost: 'admin.shop.example.test', secureCookies: true, trustProxy: true })
  assert.equal((await f.request('/api/context')).status, 421)
  const context = await f.request('/api/context', { host: 'admin.shop.example.test' })
  assert.equal(context.data.publicOrigin, 'https://shop.example.test')
  const login = await f.request('/api/auth/login', { host: 'admin.shop.example.test', method: 'POST', data: f.credentials })
  assert.equal(login.status, 200)
  assert.match(login.headers['set-cookie'][0], /^__Host-autokala_admin_session=/)
  assert.match(login.headers['set-cookie'][0], /; Secure/)
  assert.equal(/Domain=/i.test(login.headers['set-cookie'][0]), false)
})
