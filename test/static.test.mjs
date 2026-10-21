import test from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createApp } from '../server/app.mjs'

const html = '<!doctype html><html lang="fa"><title>فروشگاه آزمون</title><div id="root">صفحه آزمون</div></html>'
const javascript = `const message = 'static-cache-test';\n${'console.log(message);\n'.repeat(200)}`

async function fixture(t, options = {}) {
  const temporary = await mkdtemp(join(tmpdir(), 'autokala-static-'))
  const distPath = join(temporary, 'dist')
  let app
  t.after(async () => {
    await app?.close()
    const target = resolve(temporary)
    assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}autokala-static-`))
    await rm(target, { recursive: true, force: true })
  })
  await mkdir(join(distPath, 'assets'), { recursive: true })
  await writeFile(join(distPath, 'index.html'), html)
  await writeFile(join(distPath, 'assets', 'app-test123.js'), javascript)
  await writeFile(join(distPath, '.env'), 'PRIVATE_FILE_MUST_NOT_LEAK')
  await mkdir(join(temporary, 'private'))
  await writeFile(join(temporary, 'private', 'private.txt'), 'PRIVATE_PATH_MUST_NOT_LEAK')
  app = createApp({ dbPath: ':memory:', distPath, logger: { error() {} }, ...options })
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done))
  const port = app.server.address().port
  function request(path, { method = 'GET', headers = {}, data } = {}) {
    return new Promise((done, reject) => {
      const body = data === undefined ? null : Buffer.from(JSON.stringify(data))
      const req = httpRequest({ hostname: '127.0.0.1', port, path, method, headers: { ...(body ? { 'Content-Type': 'application/json', 'Content-Length': body.length } : {}), ...headers } }, (res) => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => done({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
        res.on('error', reject)
      })
      req.setTimeout(10000, () => req.destroy(new Error('HTTP test timeout')))
      req.on('error', reject)
      req.end(body)
    })
  }
  return { app, temporary, distPath, request }
}

test('versioned assets gzip correctly, HEAD stays empty and ETag revalidates', async (t) => {
  const f = await fixture(t)
  const path = '/assets/app-test123.js'
  const encoded = await f.request(path, { headers: { 'Accept-Encoding': 'gzip' } })
  assert.equal(encoded.status, 200)
  assert.equal(encoded.headers['content-encoding'], 'gzip')
  assert.equal(gunzipSync(encoded.body).toString(), javascript)
  assert.ok(encoded.body.length < Buffer.byteLength(javascript))
  assert.match(encoded.headers['cache-control'], /max-age=31536000, immutable/)
  assert.equal(encoded.headers.vary, 'Accept-Encoding')
  assert.match(encoded.headers['content-type'], /javascript/)
  const plain = await f.request(path, { headers: { 'Accept-Encoding': 'gzip;q=0' } })
  assert.equal(plain.status, 200)
  assert.equal(plain.headers['content-encoding'], undefined)
  assert.equal(plain.body.toString(), javascript)
  const head = await f.request(path, { method: 'HEAD', headers: { 'Accept-Encoding': 'gzip' } })
  assert.equal(head.status, 200)
  assert.equal(head.body.length, 0)
  assert.equal(Number(head.headers['content-length']), encoded.body.length)
  const cached = await f.request(path, { headers: { 'If-None-Match': encoded.headers.etag } })
  assert.equal(cached.status, 304)
  assert.equal(cached.body.length, 0)
  assert.equal(cached.headers.etag, encoded.headers.etag)
  const page = await f.request('/', { headers: { Accept: 'text/html' } })
  assert.equal(page.status, 200)
  assert.equal(page.headers['cache-control'], 'no-cache')
})

test('SPA navigation serves HTML while missing data, hidden files and traversal stay denied', async (t) => {
  const f = await fixture(t)
  const page = await f.request('/account/history', { headers: { Accept: 'text/html' } })
  assert.equal(page.status, 200)
  assert.equal(page.body.toString(), html)
  const data = await f.request('/account/history', { headers: { Accept: 'application/json' } })
  assert.equal(data.status, 404)
  assert.match(data.headers['content-type'], /application\/json/)
  for (const path of ['/.env', '/.git/config', '/%2eenv', '/..%2fprivate/private.txt', '/..%5cprivate%5cprivate.txt', '/%00', '/assets/missing.js']) {
    const result = await f.request(path, { headers: { Accept: 'text/html' } })
    assert.equal(result.status, 404, path)
    assert.equal(result.body.toString().includes('PRIVATE_'), false, path)
    assert.notEqual(result.body.toString(), html, path)
  }
  assert.equal((await f.request('/assets/app-test123.js', { method: 'POST', data: {} })).status, 405)
})

test('a directory link inside the static root cannot expose files outside it', async (t) => {
  const f = await fixture(t)
  await symlink(join(f.temporary, 'private'), join(f.distPath, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  const result = await f.request('/escape/private.txt')
  assert.equal(result.status, 404)
  assert.equal(result.body.toString().includes('PRIVATE_PATH_MUST_NOT_LEAK'), false)
})

test('production keeps security headers, secure cookies and the explicit write origin boundary', async (t) => {
  const allowed = 'https://shop.example.test'
  const f = await fixture(t, { production: true, secureCookies: true, allowedOrigins: [allowed] })
  const page = await f.request('/', { headers: { Accept: 'text/html' } })
  assert.equal(page.status, 200)
  assert.equal(page.headers['x-content-type-options'], 'nosniff')
  assert.equal(page.headers['x-frame-options'], 'DENY')
  assert.equal(page.headers['strict-transport-security'], 'max-age=31536000')
  assert.match(page.headers['content-security-policy'], /script-src 'self'/)
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/)
  assert.match(page.headers['content-security-policy'], /connect-src 'self'/)
  assert.equal(/https?:|unsafe-eval/.test(page.headers['content-security-policy']), false)
  const quote = { items: [{ productId: 1, quantity: 1 }] }
  assert.equal((await f.request('/api/quote', { method: 'POST', data: quote, headers: { Origin: 'http://localhost:8443' } })).status, 403)
  assert.equal((await f.request('/api/quote', { method: 'POST', data: quote, headers: { Origin: 'https://wrong.example.test' } })).status, 403)
  assert.equal((await f.request('/api/quote', { method: 'POST', data: quote, headers: { Origin: allowed } })).status, 200)
  const registered = await f.request('/api/auth/register', { method: 'POST', headers: { Origin: allowed }, data: { name: 'کاربر آزمون', email: 'secure@example.test', password: 'static-test-password-1234' } })
  assert.equal(registered.status, 201)
  const cookie = registered.headers['set-cookie'].join(';')
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)
  assert.match(cookie, /; Secure/)
})
