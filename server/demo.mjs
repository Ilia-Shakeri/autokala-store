import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createStore } from './store.mjs'
import { hashPassword } from './auth.mjs'

const marker = 'demo_content_v1'
const sampleCustomers = [
  ['سارا نمونه','تهران، خیابان سرو، پلاک ۱۲'],
  ['رضا نمایشی','کرج، بلوار بهار، پلاک ۸'],
  ['مریم نمونه','اصفهان، خیابان سپیدار، پلاک ۲۱'],
  ['علی نمایشی','شیراز، خیابان نارنج، پلاک ۵'],
  ['نرگس نمونه','مشهد، خیابان گلستان، پلاک ۱۷'],
  ['آرش نمایشی','تبریز، خیابان نسترن، پلاک ۹'],
].map(([name,address],index) => ({name,address:`نشانی ساختگی: ${address}`,email:`demo.customer${index+1}@example.test`,phone:`0900000000${index+1}`,postalCode:`123450000${index+1}`}))

export async function seedDemo(store) {
  if (store.settings().demo !== true) throw new Error('Demo seed requires settings.demo=true.')
  const passwordHash = await hashPassword(randomBytes(48).toString('base64url'))
  return store.transaction(() => {
    const previous = store.db.prepare('SELECT value FROM meta WHERE key=?').get(marker)
    if (previous) return { ...JSON.parse(previous.value), inserted:false }
    if (store.settings().demo !== true) throw new Error('Demo seed requires settings.demo=true.')
    const now = Date.now()
    const users = sampleCustomers.map(customer => {
      let existing = store.db.prepare('SELECT id,role FROM users WHERE email=?').get(customer.email)
      if (existing && existing.role !== 'customer') throw new Error('Demo customer email belongs to a protected account.')
      if (!existing) {
        const result = store.db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run(customer.name,customer.email,passwordHash,'customer',new Date(now).toISOString())
        existing = {id:Number(result.lastInsertRowid)}
      }
      return existing.id
    })
    const orderIds = []
    const statuses = ['completed','shipped','processing','paid','pending_payment','cancelled']
    for (let index = 0; index < 30; index++) {
      const available = store.catalog().products.filter(product => product.stock > 0)
      if (!available.length) throw new Error('Demo seed needs stock; no existing data was changed.')
      const product = available[index % available.length]
      const status = statuses[index % statuses.length]
      const customerIndex = index % sampleCustomers.length
      const created = store.createOrder({items:[{productId:product.id,quantity:1}],customer:sampleCustomers[customerIndex],note:'داده ساختگی نمایشی؛ پرداخت و ارسال واقعی ندارد.',idempotencyKey:`autokala-demo-v1-order-${String(index).padStart(3,'0')}`},users[customerIndex])
      const orderId = created.order.id
      if (status === 'cancelled') store.transitionOrder(orderId,status,null)
      else if (status !== 'pending_payment') {
        for (const next of ['paid','processing','shipped','completed']) {
          store.transitionOrder(orderId,next,null)
          if (next === status) break
        }
      }
      const timestamp = new Date(now - (status === 'pending_payment' ? index % 12 * 60 * 60 * 1000 : index * 24 * 60 * 60 * 1000)).toISOString()
      const expiresAt = new Date(Date.parse(timestamp)+24*60*60*1000).toISOString()
      store.db.prepare('UPDATE orders SET created_at=?,updated_at=?,expires_at=? WHERE id=?').run(timestamp,timestamp,expiresAt,orderId)
      store.db.prepare('UPDATE order_events SET created_at=? WHERE order_id=?').run(timestamp,orderId)
      orderIds.push(orderId)
    }
    for (const customer of sampleCustomers.slice(0,3)) store.db.prepare('INSERT INTO subscribers(phone,consent_at) VALUES (?,?) ON CONFLICT(phone) DO NOTHING').run(customer.phone,new Date(now).toISOString())
    const result = {customers:6,orders:30,subscribers:3,createdAt:new Date(now).toISOString(),orderIds}
    store.db.prepare('INSERT INTO meta(key,value) VALUES (?,?)').run(marker,JSON.stringify(result))
    return {...result,inserted:true}
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let store
  try {
    store = createStore()
    const result = await seedDemo(store)
    console.log(JSON.stringify({inserted:result.inserted,customers:result.customers,orders:result.orders,subscribers:result.subscribers}))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
  finally { store?.close() }
}
