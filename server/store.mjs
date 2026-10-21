import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash, createHmac } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { categories as seedCategories, products as seedProducts, vehicles } from './seed.mjs'

export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export function sha256(value) { return createHash('sha256').update(value).digest('hex') }

export function createStore({ dbPath = process.env.DB_PATH || resolve('server/data/store.sqlite'), seed = true, reservationTtlMs = 24 * 60 * 60 * 1000 } = {}) {
  if (!Number.isSafeInteger(reservationTtlMs) || reservationTtlMs < 1 || reservationTtlMs > 30 * 24 * 60 * 60 * 1000) throw new Error('Reservation lifetime invalid.')
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, title TEXT NOT NULL UNIQUE, icon TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL UNIQUE, brand TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price > 0), old_price INTEGER, category_id INTEGER NOT NULL REFERENCES categories(id),
      label TEXT NOT NULL DEFAULT '', visual TEXT NOT NULL, color TEXT NOT NULL,
      description TEXT NOT NULL, stock INTEGER NOT NULL CHECK(stock >= 0), vehicles TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','customer')), created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), customer TEXT NOT NULL, items TEXT NOT NULL,
      subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending_payment','paid','processing','shipped','completed','cancelled')),
      note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT,
      idempotency_hash TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
    CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY, phone TEXT NOT NULL UNIQUE, consent_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_events (id INTEGER PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), from_status TEXT, to_status TEXT NOT NULL, actor_id INTEGER REFERENCES users(id), created_at TEXT NOT NULL);
  `)
  const getMeta = (key) => db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value
  const setMeta = (key, value) => db.prepare('INSERT INTO meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value)
  let transactionDepth = 0
  const transaction = (fn) => {
    const depth = transactionDepth++
    const savepoint = `store_tx_${depth}`
    try {
      db.exec(depth ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE')
      try { const result = fn(); db.exec(depth ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT'); return result }
      catch (error) { db.exec(depth ? `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}` : 'ROLLBACK'); throw error }
    } finally { transactionDepth-- }
  }
  const schemaVersion = getMeta('schema_version')
  if (schemaVersion && !['1','2'].includes(schemaVersion)) { db.close(); throw new Error('Unsupported database schema version.') }
  transaction(() => {
    if (!schemaVersion) {
      setMeta('schema_version', '2')
      setMeta('receipt_secret', randomBytes(32).toString('hex'))
      setMeta('settings', JSON.stringify({ storeName: 'اتوکالا', shippingFee: 85000, freeShippingThreshold: 2000000, paymentMode: 'manual', demo: true }))
      if (seed) {
        for (const category of seedCategories) db.prepare('INSERT INTO categories(title,icon) VALUES (?,?)').run(category.title, category.icon)
        for (const p of seedProducts) {
          const category = db.prepare('SELECT id FROM categories WHERE title=?').get(p.category)
          db.prepare('INSERT INTO products(name,sku,brand,price,old_price,category_id,label,visual,color,description,stock,vehicles) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(p.name,p.sku,p.brand,p.price,p.oldPrice ?? null,category.id,p.label,p.visual,p.color,p.description,p.stock,JSON.stringify(p.vehicles))
        }
      }
    }
    if (schemaVersion === '1') {
      if (!db.prepare('PRAGMA table_info(orders)').all().some((column) => column.name === 'expires_at')) db.exec('ALTER TABLE orders ADD COLUMN expires_at TEXT')
      for (const row of db.prepare('SELECT id,created_at FROM orders WHERE expires_at IS NULL').all()) db.prepare('UPDATE orders SET expires_at=? WHERE id=?').run(new Date(Date.parse(row.created_at)+reservationTtlMs).toISOString(),row.id)
      setMeta('schema_version','2')
    }
  })
  db.exec('CREATE INDEX IF NOT EXISTS orders_expiry ON orders(status,expires_at)')
  const settings = () => JSON.parse(getMeta('settings'))
  const product = (row) => row ? { id: row.id, name: row.name, sku: row.sku, brand: row.brand, price: row.price, ...(row.old_price !== null ? { oldPrice: row.old_price } : {}), category: row.category, label: row.label, visual: row.visual, color: row.color, description: row.description, stock: row.stock, vehicles: JSON.parse(row.vehicles) } : null
  const productQuery = 'SELECT p.*,c.title AS category FROM products p JOIN categories c ON c.id=p.category_id'
  const catalog = () => ({ products: db.prepare(`${productQuery} ORDER BY p.id`).all().map(product), categories: db.prepare('SELECT c.id,c.title,c.icon,COUNT(p.id) AS count FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.id').all(), vehicles, settings: settings() })
  const order = (row) => row ? { id: row.id, customer: JSON.parse(row.customer), items: JSON.parse(row.items), subtotal: row.subtotal, shipping: row.shipping, total: row.total, status: row.status, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at } : null
  const receiptToken = (id) => createHmac('sha256', getMeta('receipt_secret')).update(id).digest('base64url')
  const expireReservations = (now = Date.now()) => {
    const timestamp = new Date(now).toISOString()
    if (!db.prepare("SELECT 1 FROM orders WHERE status='pending_payment' AND expires_at<=? LIMIT 1").get(timestamp)) return 0
    return transaction(() => {
      const expired = db.prepare("SELECT id,items FROM orders WHERE status='pending_payment' AND expires_at<=?").all(timestamp)
      for (const row of expired) {
        const change = db.prepare("UPDATE orders SET status='cancelled',updated_at=? WHERE id=? AND status='pending_payment'").run(timestamp,row.id)
        if (!change.changes) continue
        for (const item of JSON.parse(row.items)) db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(item.quantity,item.productId)
        db.prepare('INSERT INTO order_events(order_id,from_status,to_status,actor_id,created_at) VALUES (?,?,?,?,?)').run(row.id,'pending_payment','cancelled',null,timestamp)
      }
      return expired.length
    })
  }
  const quote = (inputItems) => {
    const items = inputItems.map(({ productId, quantity }) => {
      const p = db.prepare('SELECT id,name,price,stock FROM products WHERE id=?').get(productId)
      if (!p) throw new AppError(400, 'کالا پیدا نشد.')
      if (p.stock < quantity) throw new AppError(409, `موجودی «${p.name}» کافی نیست.`)
      return { productId: p.id, name: p.name, price: p.price, quantity, lineTotal: p.price * quantity }
    })
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
    const config = settings()
    const shipping = subtotal >= config.freeShippingThreshold ? 0 : config.shippingFee
    return { items, subtotal, shipping, total: subtotal + shipping }
  }
  const createOrder = ({ items, customer, note, idempotencyKey, expectedTotal }, userId = null) => {
    expireReservations()
    return transaction(() => {
    const idempotencyHash = sha256(idempotencyKey)
    const requestHash = sha256(JSON.stringify({ items, customer, note, userId, expectedTotal }))
    const previous = db.prepare('SELECT * FROM orders WHERE idempotency_hash=?').get(idempotencyHash)
    if (previous) {
      if (previous.request_hash !== requestHash) throw new AppError(409, 'کلید سفارش تکراری است. درخواست تازه بسازید.')
      return { order: order(previous), receiptToken: receiptToken(previous.id), replayed: true }
    }
    const result = quote(items)
    if (expectedTotal !== undefined && result.total !== expectedTotal) throw new AppError(409,'قیمت یا هزینه ارسال تغییر کرده؛ مبلغ را دوباره دریافت کنید.')
    const id = `AK-${randomBytes(8).toString('hex').toUpperCase()}`
    const now = new Date().toISOString()
    for (const item of result.items) {
      const change = db.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?').run(item.quantity,item.productId,item.quantity)
      if (change.changes !== 1) throw new AppError(409, 'موجودی تغییر کرد. سبد را بازبینی کنید.')
    }
    const expiresAt = new Date(Date.parse(now)+reservationTtlMs).toISOString()
    db.prepare('INSERT INTO orders(id,user_id,customer,items,subtotal,shipping,total,status,note,created_at,updated_at,expires_at,idempotency_hash,request_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,userId,JSON.stringify(customer),JSON.stringify(result.items),result.subtotal,result.shipping,result.total,'pending_payment',note,now,now,expiresAt,idempotencyHash,requestHash)
    db.prepare('INSERT INTO order_events(order_id,to_status,actor_id,created_at) VALUES (?,?,?,?)').run(id,'pending_payment',userId,now)
    return { order: order(db.prepare('SELECT * FROM orders WHERE id=?').get(id)), receiptToken: receiptToken(id), replayed: false }
    })
  }
  const transitionOrder = (id, status, actorId) => {
    expireReservations()
    return transaction(() => {
    const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id)
    if (!row) throw new AppError(404, 'سفارش پیدا نشد.')
    if (row.status === status) return order(row)
    const transitions = { pending_payment: ['paid','cancelled'], paid: ['processing'], processing: ['shipped'], shipped: ['completed'], completed: [], cancelled: [] }
    if (!transitions[row.status]?.includes(status)) throw new AppError(409, 'این تغییر وضعیت مجاز نیست.')
    // Paid orders need a real refund workflow before cancellation can be enabled.
    if (status === 'cancelled') for (const item of JSON.parse(row.items)) db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(item.quantity,item.productId)
    const now = new Date().toISOString()
    db.prepare('UPDATE orders SET status=?,updated_at=? WHERE id=?').run(status,now,id)
    db.prepare('INSERT INTO order_events(order_id,from_status,to_status,actor_id,created_at) VALUES (?,?,?,?,?)').run(id,row.status,status,actorId,now)
    return order(db.prepare('SELECT * FROM orders WHERE id=?').get(id))
    })
  }
  let closed = false
  return { db, transaction, settings, setSettings(value) { setMeta('settings',JSON.stringify(value)); return value }, catalog, quote, createOrder, expireReservations, transitionOrder, order, receiptToken, product, productQuery, close() { if (!closed) { closed = true; db.close() } } }
}
