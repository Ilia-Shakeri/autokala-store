import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createApp } from '../server/app.mjs'
import { hashPassword, verifyPassword } from '../server/auth.mjs'

const customer = { name: 'خریدار آزمون', email: 'buyer@example.test', phone: '09123456789', address: 'تهران، خیابان آزمون، پلاک ۱۲', postalCode: '1234567890' }
const orderInput = (items = [{ productId: 1, quantity: 1 }], extra = {}) => ({ items, customer, note: '', idempotencyKey: randomUUID(), ...extra })

async function fixture(t, options = {}) {
  const app = createApp({ dbPath: ':memory:', logger: { error() {} }, ...options })
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done))
  const base = `http://127.0.0.1:${app.server.address().port}`
  let closed = false
  const close = async () => { if (!closed) { closed = true; await app.close() } }
  t.after(close)
  function client(initialCookie = '', host = '') {
    let cookie = initialCookie
    return {
      get cookie() { return cookie },
      async request(path, { method = 'GET', data, headers = {}, raw } = {}) {
        const response = await fetch(`${host ? `http://${host}` : base}${path}`, {
          method,
          headers: { ...(host ? { Host: host } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
          body: raw ?? (data !== undefined ? JSON.stringify(data) : undefined),
          signal: AbortSignal.timeout(10000),
        })
        const nextCookie = response.headers.get('set-cookie')
        if (nextCookie) cookie = nextCookie.split(';')[0]
        const text = await response.text()
        return { status: response.status, headers: response.headers, data: text ? JSON.parse(text) : null }
      },
    }
  }
  async function admin() {
    const email = `admin-${randomUUID()}@example.test`
    const password = `test-${randomUUID()}`
    app.store.db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run('مدیر آزمون', email, await hashPassword(password), 'admin', new Date().toISOString())
    const result = client('',`localhost:${app.server.address().port}`)
    const login = await result.request('/api/auth/login', { method: 'POST', data: { email, password } })
    assert.equal(login.status, 200)
    return result
  }
  return { ...app, base, client, admin, close }
}

async function register(client, name = 'کاربر آزمون') {
  const data = { name, email: `${randomUUID()}@example.test`, password: `test-${randomUUID()}`, role: 'admin' }
  const result = await client.request('/api/auth/register', { method: 'POST', data })
  assert.equal(result.status, 201)
  assert.equal(result.data.user.role, 'customer')
  assert.equal('password_hash' in result.data.user, false)
  return data
}

test('health, catalog revalidation and headers work without a session', async (t) => {
  const f = await fixture(t)
  const c = f.client()
  assert.equal((await c.request('/health/live')).data.live, true)
  assert.equal((await c.request('/health/ready')).data.ready, true)
  const catalog = await c.request('/api/catalog')
  assert.equal(catalog.status, 200)
  assert.ok(catalog.data.products.length >= 12)
  assert.equal(catalog.data.settings.demo, true)
  assert.equal(catalog.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(catalog.headers.get('cache-control'), 'no-cache')
  assert.ok(catalog.headers.get('etag'))
  assert.equal((await c.request('/api/catalog', { headers: { 'If-None-Match': catalog.headers.get('etag') } })).status, 304)
  assert.equal((await c.request('/api/session')).data.user, null)
})

test('quote rejects bad quantities and uses database prices with merged duplicate lines', async (t) => {
  const f = await fixture(t)
  const c = f.client()
  const price = f.store.catalog().products[0].price
  for (const quantity of [0, -1, 1.5, '2', 100, null]) {
    assert.equal((await c.request('/api/quote', { method: 'POST', data: { items: [{ productId: 1, quantity }] } })).status, 400)
  }
  for (const items of [[], [{ productId: -1, quantity: 1 }], [{ productId: 999999, quantity: 1 }], [{ productId: 1, quantity: 99 }, { productId: 1, quantity: 1 }]]) {
    assert.equal((await c.request('/api/quote', { method: 'POST', data: { items } })).status, 400)
  }
  const quote = await c.request('/api/quote', { method: 'POST', data: { items: [{ productId: 1, quantity: 1, price: 1 }, { productId: 1, quantity: 2, price: -1 }], subtotal: 1, shipping: 0, total: 1 } })
  assert.equal(quote.status, 200)
  assert.equal(quote.data.items.length, 1)
  assert.equal(quote.data.items[0].quantity, 3)
  assert.equal(quote.data.subtotal, price * 3)
  assert.equal(quote.data.total, quote.data.subtotal + quote.data.shipping)
})

test('checkout rejects malformed customer fields before reserving stock', async (t) => {
  const f = await fixture(t)
  const c = f.client()
  const stock = f.store.catalog().products[0].stock
  for (const change of [{ phone: '123' }, { postalCode: '1111111111' }, { email: 'invalid' }, { address: 'short' }, { name: '' }]) {
    const result = await c.request('/api/orders', { method: 'POST', data: orderInput(undefined, { customer: { ...customer, ...change } }) })
    assert.equal(result.status, 400)
  }
  assert.equal(f.store.catalog().products[0].stock, stock)
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0)
})

test('order price is authoritative and idempotent retries reserve stock once', async (t) => {
  const f = await fixture(t)
  const c = f.client()
  const before = f.store.catalog().products[0]
  const input = orderInput([{ productId: 1, quantity: 2, price: 1 }], { total: 1, shipping: -500 })
  const first = await c.request('/api/orders', { method: 'POST', data: input })
  assert.equal(first.status, 201)
  assert.equal(first.data.order.status, 'pending_payment')
  assert.equal(first.data.order.subtotal, before.price * 2)
  assert.equal(first.data.order.total, first.data.order.subtotal + first.data.order.shipping)
  assert.ok(first.data.receiptToken)
  const replay = await c.request('/api/orders', { method: 'POST', data: input })
  assert.equal(replay.status, 201)
  assert.equal(replay.headers.get('idempotency-replayed'), 'true')
  assert.equal(replay.data.order.id, first.data.order.id)
  assert.equal(replay.data.receiptToken, first.data.receiptToken)
  assert.equal(f.store.catalog().products[0].stock, before.stock - 2)
  const conflict = await c.request('/api/orders', { method: 'POST', data: { ...input, note: 'درخواست دیگر' } })
  assert.equal(conflict.status, 409)
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1)
})

test('insufficient stock rolls the full order back', async (t) => {
  const f = await fixture(t)
  const before = f.store.catalog().products.slice(0, 2)
  const result = await f.client().request('/api/orders', { method: 'POST', data: orderInput([{ productId: before[0].id, quantity: 1 }, { productId: before[1].id, quantity: before[1].stock + 1 }]) })
  assert.equal(result.status, 409)
  assert.deepEqual(f.store.catalog().products.slice(0, 2).map(p => p.stock), before.map(p => p.stock))
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0)
})

test('checkout rejects a stale displayed total without reserving stock and permits an explicit refreshed total', async (t) => {
  const f = await fixture(t)
  const c = f.client()
  const admin = await f.admin()
  const items = [{ productId:1,quantity:1 }]
  const initial = await c.request('/api/quote',{method:'POST',data:{items}})
  const stock = f.store.catalog().products[0].stock
  const config = f.store.settings()
  assert.equal((await admin.request('/api/admin/settings',{method:'PATCH',data:{shippingFee:config.shippingFee+1000}})).status,200)
  const input = orderInput(items,{expectedTotal:initial.data.total})
  const stale = await c.request('/api/orders',{method:'POST',data:input})
  assert.equal(stale.status,409)
  assert.match(stale.data.error,/مبلغ را دوباره/)
  assert.equal(f.store.catalog().products[0].stock,stock)
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,0)
  for (const expectedTotal of [-1,0,1.5,'1',null,Number.MAX_SAFE_INTEGER+1]) assert.equal((await c.request('/api/orders',{method:'POST',data:{...input,expectedTotal}})).status,400)
  const fresh = await c.request('/api/quote',{method:'POST',data:{items}})
  const accepted = await c.request('/api/orders',{method:'POST',data:{...input,expectedTotal:fresh.data.total}})
  assert.equal(accepted.status,201)
  assert.equal(accepted.data.order.total,fresh.data.total)
  assert.equal(f.store.catalog().products[0].stock,stock-1)
  const replay = await c.request('/api/orders',{method:'POST',data:{...input,expectedTotal:fresh.data.total}})
  assert.equal(replay.headers.get('idempotency-replayed'),'true')
  assert.equal(replay.data.order.id,accepted.data.order.id)
})

test('concurrent buyers cannot sell the last unit twice', async (t) => {
  const f = await fixture(t)
  f.store.db.prepare('UPDATE products SET stock=1 WHERE id=1').run()
  const before = await f.client().request('/api/catalog')
  const responses = await Promise.all([f.client().request('/api/orders', { method: 'POST', data: orderInput() }), f.client().request('/api/orders', { method: 'POST', data: orderInput() })])
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409])
  assert.equal(f.store.catalog().products[0].stock, 0)
  const after = await f.client().request('/api/catalog', { headers: { 'If-None-Match': before.headers.get('etag') } })
  assert.equal(after.status, 200)
  assert.equal(after.data.products[0].stock, 0)
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1)
})

test('guest order data requires its receipt token and does not leak by identifier', async (t) => {
  const f = await fixture(t)
  const c = f.client()
  const result = await c.request('/api/orders', { method: 'POST', data: orderInput() })
  const path = `/api/orders/${result.data.order.id}`
  assert.equal((await c.request('/api/orders')).status, 401)
  assert.equal((await c.request(path)).status, 404)
  assert.equal((await c.request(path, { headers: { 'X-Receipt-Token': 'wrong' } })).status, 404)
  assert.equal((await c.request(path, { headers: { 'X-Receipt-Token': 'é'.repeat(43) } })).status, 404)
  const receipt = await c.request(path, { headers: { 'X-Receipt-Token': result.data.receiptToken } })
  assert.equal(receipt.status, 200)
  assert.equal(receipt.data.order.customer.email, customer.email)
  const other = f.client()
  await register(other)
  assert.equal((await other.request(path)).status, 404)
  assert.equal((await other.request('/api/orders')).data.orders.length, 0)
})

test('customer login, own orders, role boundary and logout work', async (t) => {
  const f = await fixture(t)
  const anonymous = f.client()
  assert.equal((await anonymous.request('/api/admin/overview')).status, 404)
  const owner = f.client()
  const credentials = await register(owner)
  const session = await owner.request('/api/session')
  assert.equal(session.data.user.email, credentials.email)
  assert.equal((await owner.request('/api/admin/overview')).status, 404)
  assert.equal((await owner.request('/api/admin/settings', { method: 'PATCH', data: { shippingFee: 0 } })).status, 404)
  const created = await owner.request('/api/orders', { method: 'POST', data: orderInput() })
  assert.equal(created.status, 201)
  assert.equal((await owner.request(`/api/orders/${created.data.order.id}`)).status, 200)
  assert.equal((await owner.request('/api/orders')).data.orders[0].id, created.data.order.id)
  const second = f.client()
  await register(second)
  assert.equal((await second.request(`/api/orders/${created.data.order.id}`)).status, 404)
  const staleCookie = owner.cookie
  assert.equal((await owner.request('/api/auth/logout', { method: 'POST', data: {} })).status, 200)
  assert.equal((await f.client(staleCookie).request('/api/session')).data.user, null)
  assert.equal((await owner.request('/api/orders')).status, 401)
  assert.equal((await owner.request('/api/auth/login', { method: 'POST', data: { ...credentials, password: 'incorrect-password' } })).status, 401)
  const login = await owner.request('/api/auth/login', { method: 'POST', data: credentials })
  assert.equal(login.status, 200)
  assert.match(login.headers.get('set-cookie'), /HttpOnly/)
  assert.match(login.headers.get('set-cookie'), /SameSite=Lax/)
  assert.equal((await owner.request('/api/orders')).data.orders.length, 1)
})

test('bad Origin and cross-site writes fail, allowed same-origin writes work', async (t) => {
  const f = await fixture(t)
  const data = { items: [{ productId: 1, quantity: 1 }] }
  assert.equal((await f.client().request('/api/quote', { method: 'POST', data, headers: { Origin: 'https://wrong.example' } })).status, 403)
  assert.equal((await f.client().request('/api/quote', { method: 'POST', data, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
  assert.equal((await f.client().request('/api/quote', { method: 'POST', data, headers: { Origin: f.base } })).status, 200)
})

test('admin product, category and settings changes reach the catalog and quote', async (t) => {
  const f = await fixture(t)
  const admin = await f.admin()
  const prior = await admin.request('/api/catalog')
  const category = await admin.request('/api/admin/categories', { method: 'POST', data: { title: 'قطعه آزمون', icon: 'filter' } })
  assert.equal(category.status, 201)
  const sample = f.store.catalog().products[0]
  const input = { ...sample, sku: `TEST-${randomUUID()}`, name: 'قطعه آزمون ثبت کالا', category: 'قطعه آزمون', price: 100000, oldPrice: null, stock: 4 }
  const created = await admin.request('/api/admin/products', { method: 'POST', data: input })
  assert.equal(created.status, 201)
  const id = created.data.product.id
  assert.equal((await admin.request('/api/admin/products', { method: 'POST', data: input })).status, 409)
  assert.equal((await admin.request(`/api/admin/products/${id}`, { method: 'PATCH', data: { stock: -1 } })).status, 400)
  assert.equal((await admin.request(`/api/admin/products/${id}`, { method: 'PATCH', data: { price: 120000, stock: 7 } })).status, 200)
  const settings = await admin.request('/api/admin/settings', { method: 'PATCH', data: { shippingFee: 42000, freeShippingThreshold: 500000 } })
  assert.equal(settings.status, 200)
  const catalog = await admin.request('/api/catalog', { headers: { 'If-None-Match': prior.headers.get('etag') } })
  assert.equal(catalog.status, 200)
  assert.equal(catalog.data.products.find(p => p.id === id).price, 120000)
  assert.equal(catalog.data.products.find(p => p.id === id).stock, 7)
  const quote = await admin.request('/api/quote', { method: 'POST', data: { items: [{ productId: id, quantity: 1 }] } })
  assert.equal(quote.data.total, 162000)
  assert.equal((await admin.request('/api/admin/settings', { method: 'PATCH', data: { demo: false } })).status, 400)
})

test('order status machine blocks skips and cancellation restores exactly once', async (t) => {
  const f = await fixture(t)
  const admin = await f.admin()
  const before = f.store.catalog().products[0].stock
  const created = await f.client().request('/api/orders', { method: 'POST', data: orderInput([{ productId: 1, quantity: 2 }]) })
  const path = `/api/admin/orders/${created.data.order.id}`
  assert.equal((await admin.request(path, { method: 'PATCH', data: { status: 'shipped' } })).status, 409)
  assert.equal((await admin.request(path, { method: 'PATCH', data: { status: 'cancelled' } })).status, 200)
  assert.equal(f.store.catalog().products[0].stock, before)
  assert.equal((await admin.request(path, { method: 'PATCH', data: { status: 'cancelled' } })).status, 200)
  assert.equal(f.store.catalog().products[0].stock, before)
  assert.equal((await admin.request(path, { method: 'PATCH', data: { status: 'paid' } })).status, 409)
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM order_events WHERE order_id=?').get(created.data.order.id).n, 2)
  assert.equal((await admin.request('/api/admin/overview')).data.metrics.revenue, 0)
})

test('paid orders require sequential fulfilment and paid-only revenue', async (t) => {
  const f = await fixture(t)
  const admin = await f.admin()
  const created = await f.client().request('/api/orders', { method: 'POST', data: orderInput() })
  const path = `/api/admin/orders/${created.data.order.id}`
  for (const status of ['paid', 'processing', 'shipped', 'completed']) {
    assert.equal((await admin.request(path, { method: 'PATCH', data: { status } })).status, 200)
    if (status === 'paid') assert.equal((await admin.request(path, { method: 'PATCH', data: { status: 'cancelled' } })).status, 409)
  }
  assert.equal((await admin.request(path, { method: 'PATCH', data: { status: 'paid' } })).status, 409)
  const overview = await admin.request('/api/admin/overview')
  assert.equal(overview.data.metrics.revenue, created.data.order.total)
  assert.equal(overview.data.metrics.orders, 1)
})

test('JSON body, size limit, consent and auth throttle reject abuse', async (t) => {
  const f = await fixture(t)
  const c = f.client()
  assert.equal((await c.request('/api/quote', { method: 'POST', raw: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415)
  assert.equal((await c.request('/api/quote', { method: 'POST', raw: '{broken', headers: { 'Content-Type': 'application/json' } })).status, 400)
  assert.equal((await c.request('/api/quote', { method: 'POST', raw: 'null', headers: { 'Content-Type': 'application/json' } })).status, 400)
  assert.equal((await c.request('/api/quote', { method: 'POST', data: { padding: 'x'.repeat(65536) } })).status, 413)
  assert.equal((await c.request('/api/subscribe', { method: 'POST', data: { phone: '09123456789', consent: false } })).status, 400)
  assert.equal((await c.request('/api/subscribe', { method: 'POST', data: { phone: '۰۹۱۲۳۴۵۶۷۸۹', consent: true } })).status, 201)
  assert.equal((await c.request('/api/subscribe', { method: 'POST', data: { phone: '+989123456789', consent: true } })).status, 201)
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n, 1)
  for (let i = 0; i < 15; i++) assert.equal((await c.request('/api/auth/login', { method: 'POST', data: { email: 'bad@example.test', password: 'short' } })).status, 400)
  assert.equal((await c.request('/api/auth/login', { method: 'POST', data: { email: 'bad@example.test', password: 'short' } })).status, 429)
})

test('persistent orders, stock and receipt secret survive database reopen', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'autokala-tests-'))
  let first
  let second
  t.after(async () => {
    await second?.close()
    await first?.close()
    const resolved = resolve(temporary)
    assert.ok(resolved.startsWith(`${resolve(tmpdir())}${sep}autokala-tests-`))
    await rm(resolved, { recursive: true, force: true })
  })
  const dbPath = join(temporary, 'store.sqlite')
  first = await fixture(t, { dbPath })
  const before = first.store.catalog().products[0].stock
  const input = orderInput()
  const created = await first.client().request('/api/orders', { method: 'POST', data: input })
  assert.equal(created.status, 201)
  await first.close()
  second = await fixture(t, { dbPath })
  const receipt = await second.client().request(`/api/orders/${created.data.order.id}`, { headers: { 'X-Receipt-Token': created.data.receiptToken } })
  assert.equal(receipt.status, 200)
  assert.equal(receipt.data.order.total, created.data.order.total)
  assert.equal(second.store.catalog().products[0].stock, before - 1)
  const retried = await second.client().request('/api/orders', { method: 'POST', data: input })
  assert.equal(retried.data.order.id, created.data.order.id)
  assert.equal(second.store.catalog().products[0].stock, before - 1)
  await second.close()
})

test('expired unpaid reservations restore stock once while paid orders remain reserved', async (t) => {
  const f = await fixture(t)
  const admin = await f.admin()
  const before = f.store.catalog().products[0].stock
  const created = await f.client().request('/api/orders', { method: 'POST', data: orderInput([{ productId: 1, quantity: 2 }]) })
  assert.equal(created.status, 201)
  assert.ok(Date.parse(created.data.order.expiresAt) > Date.now())
  f.store.db.prepare('UPDATE orders SET expires_at=? WHERE id=?').run(new Date(Date.now() - 1000).toISOString(), created.data.order.id)
  assert.equal(f.store.expireReservations(), 1)
  assert.equal(f.store.expireReservations(), 0)
  assert.equal(f.store.catalog().products[0].stock, before)
  assert.equal(f.store.db.prepare('SELECT status FROM orders WHERE id=?').get(created.data.order.id).status, 'cancelled')
  const paid = await f.client().request('/api/orders', { method: 'POST', data: orderInput() })
  assert.equal((await admin.request(`/api/admin/orders/${paid.data.order.id}`, { method: 'PATCH', data: { status: 'paid' } })).status, 200)
  f.store.db.prepare('UPDATE orders SET expires_at=? WHERE id=?').run(new Date(Date.now() - 1000).toISOString(), paid.data.order.id)
  assert.equal(f.store.expireReservations(), 0)
  assert.equal(f.store.catalog().products[0].stock, before - 1)
  assert.equal(f.store.db.prepare('SELECT status FROM orders WHERE id=?').get(paid.data.order.id).status, 'paid')
})

test('checkout clears an expired reservation before checking the next buyer stock', async (t) => {
  const f = await fixture(t)
  f.store.db.prepare('UPDATE products SET stock=1 WHERE id=1').run()
  const old = await f.client().request('/api/orders', { method: 'POST', data: orderInput() })
  assert.equal(old.status, 201)
  f.store.db.prepare('UPDATE orders SET expires_at=? WHERE id=?').run(new Date(Date.now() - 1000).toISOString(), old.data.order.id)
  const next = await f.client().request('/api/orders', { method: 'POST', data: orderInput() })
  assert.equal(next.status, 201)
  assert.notEqual(next.data.order.id, old.data.order.id)
  assert.equal(f.store.db.prepare('SELECT status FROM orders WHERE id=?').get(old.data.order.id).status, 'cancelled')
  assert.equal(f.store.catalog().products[0].stock, 0)
})

test('order pagination is bounded and reports use persisted status totals', async (t) => {
  const f = await fixture(t)
  const admin = await f.admin()
  const owner = f.client()
  await register(owner)
  const orders = []
  for (let i = 0; i < 4; i++) {
    const created = await owner.request('/api/orders', { method: 'POST', data: orderInput() })
    assert.equal(created.status, 201)
    orders.push(created.data.order)
  }
  assert.equal((await admin.request(`/api/admin/orders/${orders[0].id}`, { method: 'PATCH', data: { status: 'paid' } })).status, 200)
  assert.equal((await admin.request(`/api/admin/orders/${orders[1].id}`, { method: 'PATCH', data: { status: 'cancelled' } })).status, 200)
  const page = await admin.request('/api/admin/orders?offset=1&limit=2')
  assert.equal(page.status, 200)
  assert.equal(page.data.orders.length, 2)
  assert.deepEqual(page.data.pagination, { total: 4, limit: 2, offset: 1, hasMore: true })
  const end = await owner.request('/api/orders?offset=3&limit=2')
  assert.equal(end.status, 200)
  assert.equal(end.data.orders.length, 1)
  assert.equal(end.data.pagination.hasMore, false)
  assert.equal((await admin.request('/api/admin/orders?limit=201')).status, 400)
  assert.equal((await admin.request('/api/admin/orders?offset=-1')).status, 400)
  assert.equal((await owner.request('/api/orders?offset=-1')).status, 400)
  const pending = await admin.request('/api/admin/orders?status=pending_payment&limit=1')
  assert.equal(pending.status, 200)
  assert.equal(pending.data.orders.length, 1)
  assert.equal(pending.data.orders[0].status, 'pending_payment')
  assert.equal(pending.data.pagination.total, 2)
  const exact = await admin.request(`/api/admin/orders?status=paid&query=${encodeURIComponent(orders[0].id)}`)
  assert.equal(exact.status, 200)
  assert.equal(exact.data.orders[0].id, orders[0].id)
  assert.equal(exact.data.pagination.total, 1)
  assert.equal((await admin.request('/api/admin/orders?status=wrong')).status, 400)
  assert.equal((await admin.request('/api/admin/orders?query=no-such-order')).data.pagination.total, 0)
  assert.equal((await owner.request('/api/subscribe', { method: 'POST', data: { phone: customer.phone, consent: true } })).status, 201)
  const midnight = new Date(Date.now() - 24 * 60 * 60 * 1000)
  midnight.setUTCHours(21, 30, 0, 0)
  f.store.db.prepare('UPDATE orders SET created_at=? WHERE id=?').run(midnight.toISOString(), orders[0].id)
  const tehranDate = new Date(midnight.getTime() + 3.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const overview = await admin.request('/api/admin/overview?offset=0&limit=2')
  assert.equal(overview.status, 200)
  assert.equal(overview.data.orders.length, 2)
  assert.equal(overview.data.pagination.total, 4)
  assert.equal(overview.data.metrics.revenue, orders[0].total)
  assert.equal(overview.data.metrics.subscribers, 1)
  assert.equal(overview.data.reports.byStatus.find(row => row.status === 'paid').count, 1)
  assert.equal(overview.data.reports.byStatus.find(row => row.status === 'cancelled').count, 1)
  assert.equal(overview.data.reports.byDay.reduce((sum, row) => sum + row.total, 0), orders[0].total)
  assert.equal(overview.data.reports.byDay.find(row => row.date === tehranDate).total, orders[0].total)
  const filtered = await admin.request('/api/admin/overview?status=cancelled')
  assert.equal(filtered.data.pagination.total, 1)
  assert.equal(filtered.data.metrics.orders, 4)
  assert.equal(filtered.data.metrics.revenue, orders[0].total)
  assert.equal(filtered.data.reports.byStatus.find(row => row.status === 'paid').count, 1)
})

test('schema one migrates on reopen and startup releases an old reservation once', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'autokala-tests-'))
  const opened = []
  t.after(async () => {
    for (const app of opened.reverse()) await app.close()
    const resolved = resolve(temporary)
    assert.ok(resolved.startsWith(`${resolve(tmpdir())}${sep}autokala-tests-`))
    await rm(resolved, { recursive: true, force: true })
  })
  const dbPath = join(temporary, 'legacy.sqlite')
  const first = await fixture(t, { dbPath })
  opened.push(first)
  const before = first.store.catalog().products[0].stock
  const created = await first.client().request('/api/orders', { method: 'POST', data: orderInput() })
  assert.equal(created.status, 201)
  const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  first.store.db.prepare('UPDATE orders SET created_at=? WHERE id=?').run(oldDate, created.data.order.id)
  first.store.db.exec('DROP INDEX orders_expiry; ALTER TABLE orders DROP COLUMN expires_at;')
  first.store.db.prepare("UPDATE meta SET value='1' WHERE key='schema_version'").run()
  await first.close()
  const second = await fixture(t, { dbPath })
  opened.push(second)
  assert.equal(second.store.db.prepare("SELECT value FROM meta WHERE key='schema_version'").get().value, '2')
  assert.equal(second.store.catalog().products[0].stock, before)
  const result = await second.client().request(`/api/orders/${created.data.order.id}`, { headers: { 'X-Receipt-Token': created.data.receiptToken } })
  assert.equal(result.status, 200)
  assert.equal(result.data.order.status, 'cancelled')
  assert.ok(Number.isFinite(Date.parse(result.data.order.expiresAt)))
  assert.equal(result.data.order.customer.email, customer.email)
  await second.close()
  const third = await fixture(t, { dbPath })
  opened.push(third)
  assert.equal(third.store.catalog().products[0].stock, before)
  assert.equal(third.store.db.prepare('SELECT COUNT(*) AS n FROM order_events WHERE order_id=?').get(created.data.order.id).n, 2)
})

test('only the last valid forwarded address from a trusted local proxy controls auth limits', async (t) => {
  const trusted = await fixture(t, { trustProxy: true })
  const wrongLogin = { email: 'missing@example.test', password: 'wrong-password-long' }
  for (let i = 0; i < 15; i++) {
    const result = await trusted.client().request('/api/auth/login', { method: 'POST', data: wrongLogin, headers: { 'X-Forwarded-For': `198.51.100.${i + 1}, 203.0.113.10` } })
    assert.equal(result.status, 401)
  }
  assert.equal((await trusted.client().request('/api/auth/login', { method: 'POST', data: wrongLogin, headers: { 'X-Forwarded-For': '192.0.2.250, 203.0.113.10' } })).status, 429)
  assert.equal((await trusted.client().request('/api/auth/login', { method: 'POST', data: wrongLogin, headers: { 'X-Forwarded-For': '192.0.2.250, 203.0.113.11' } })).status, 401)
  const untrusted = await fixture(t, { trustProxy: false })
  for (let i = 0; i < 15; i++) {
    assert.equal((await untrusted.client().request('/api/auth/login', { method: 'POST', data: wrongLogin, headers: { 'X-Forwarded-For': `203.0.113.${i + 1}` } })).status, 401)
  }
  assert.equal((await untrusted.client().request('/api/auth/login', { method: 'POST', data: wrongLogin, headers: { 'X-Forwarded-For': '203.0.113.200' } })).status, 429)
})

test('password hashes retain legacy account compatibility while new hashes state their cost', async () => {
  const password = `test-${randomUUID()}`
  const encoded = await hashPassword(password)
  assert.match(encoded, /^scrypt\$16384\$8\$1\$/)
  const legacy = encoded.split('$').slice(-2).join(':')
  assert.equal(await verifyPassword(password, encoded), true)
  assert.equal(await verifyPassword(password, legacy), true)
  assert.equal(await verifyPassword('wrong-password-long', legacy), false)
  assert.equal(await verifyPassword(password, 'broken:hash'), false)
})
