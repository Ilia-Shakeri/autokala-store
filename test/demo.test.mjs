import test from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../server/store.mjs'
import { seedDemo } from '../server/demo.mjs'

test('demo seed adds marked sample content once and preserves existing orders', async t => {
  const store = createStore({dbPath:':memory:'})
  t.after(() => store.close())
  const initialStock = store.catalog().products.reduce((sum,product) => sum+product.stock,0)
  const customer = {name:'خریدار قبلی',email:'prior@example.test',phone:'09123456789',address:'تهران، نشانی آزمون پیشین، پلاک ۲',postalCode:'1234567890'}
  const prior = store.createOrder({items:[{productId:1,quantity:1}],customer,note:'Existing order stays unchanged',idempotencyKey:'existing-order-before-demo'}).order
  const result = await seedDemo(store)
  assert.equal(result.inserted,true)
  assert.equal(result.orderIds.length,30)
  assert.equal(new Set(result.orderIds).size,30)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,31)
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE note LIKE 'داده ساختگی نمایشی%'").get().n,30)
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='customer'").get().n,6)
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n,0)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n,3)
  assert.deepEqual(store.db.prepare('SELECT status,COUNT(*) AS n FROM orders WHERE id<>? GROUP BY status ORDER BY status').all(prior.id).map(row => row.n),[5,5,5,5,5,5])
  for (const row of store.db.prepare("SELECT created_at,expires_at FROM orders WHERE note LIKE 'داده ساختگی نمایشی%'").all()) assert.equal(Date.parse(row.expires_at)-Date.parse(row.created_at),24*60*60*1000)
  assert.deepEqual(store.order(store.db.prepare('SELECT * FROM orders WHERE id=?').get(prior.id)),prior)
  assert.equal(store.catalog().products.reduce((sum,product) => sum+product.stock,0),initialStock-26)
  const stockAfter = store.catalog().products.map(product => product.stock)
  const repeated = await seedDemo(store)
  assert.equal(repeated.inserted,false)
  assert.deepEqual(repeated.orderIds,result.orderIds)
  assert.deepEqual(store.catalog().products.map(product => product.stock),stockAfter)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,31)
  assert.equal(store.settings().paymentMode,'manual')
})

test('demo seed refuses non-demo data and rolls back every sample write when inventory is empty', async t => {
  const store = createStore({dbPath:':memory:'})
  t.after(() => store.close())
  store.setSettings({...store.settings(),demo:false})
  await assert.rejects(() => seedDemo(store),/demo=true/)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,0)
  store.setSettings({...store.settings(),demo:true})
  store.db.prepare('UPDATE products SET stock=0').run()
  await assert.rejects(() => seedDemo(store),/needs stock/)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,0)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,0)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n,0)
  assert.equal(store.db.prepare("SELECT value FROM meta WHERE key='demo_content_v1'").get(),undefined)
})

test('a later demo failure rolls back nested orders, stock and order events together', async t => {
  const store = createStore({dbPath:':memory:'})
  t.after(() => store.close())
  store.db.prepare('UPDATE products SET stock=0').run()
  store.db.prepare('UPDATE products SET stock=2 WHERE id=1').run()
  await assert.rejects(() => seedDemo(store),/needs stock/)
  assert.equal(store.catalog().products[0].stock,2)
  for (const table of ['users','orders','order_events','subscribers']) assert.equal(store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0,table)
})
