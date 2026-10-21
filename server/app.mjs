import { createServer as createHttpServer } from 'node:http'
import { readFileSync, statSync, realpathSync, existsSync } from 'node:fs'
import { resolve, sep, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { timingSafeEqual } from 'node:crypto'
import { createStore, AppError, sha256 } from './store.mjs'
import * as valid from './validation.mjs'
import { createSession, hashPassword, verifyPassword, sessionUser, sessionToken, sessionCookie, publicUser } from './auth.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)),'..')
const MAX_BODY = 64 * 1024
const allowedLocalOrigins = ['http://localhost:8443','http://127.0.0.1:8443','http://localhost:5173','http://127.0.0.1:5173']
const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.pdf':'application/pdf' }

function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new AppError(415,'نوع درخواست باید JSON باشد.')
  if (Number(req.headers['content-length']) > MAX_BODY) { req.resume(); throw new AppError(413,'درخواست بزرگ است.') }
  return new Promise((resolveBody,reject) => {
    const chunks = []; let size = 0; let tooLarge = false
    req.on('data',(chunk) => { size += chunk.length; if (size > MAX_BODY) { if (!tooLarge) { tooLarge = true; reject(new AppError(413,'درخواست بزرگ است.')) } } else if (!tooLarge) chunks.push(chunk) })
    req.on('end',() => { if (tooLarge) return; try { resolveBody(valid.object(JSON.parse(Buffer.concat(chunks).toString('utf8')))) } catch (error) { reject(error instanceof AppError ? error : new AppError(400,'متن JSON درست نیست.')) } })
    req.on('error',reject)
    req.on('aborted',() => reject(new AppError(400,'درخواست قطع شد.')))
  })
}

export function createApp({ dbPath, seed = true, reservationTtlMs = 24*60*60*1000, distPath = resolve(root,'dist'), allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean), production = process.env.NODE_ENV === 'production', trustProxy = process.env.TRUST_PROXY === 'true', secureCookies = process.env.SECURE_COOKIES === 'true', logger = console } = {}) {
  const store = createStore({ dbPath, seed, reservationTtlMs })
  const limits = new Map()
  const files = new Map()
  const originAllowlist = new Set([...allowedOrigins,...(!production ? allowedLocalOrigins : [])])
  let catalogCache
  const invalidate = () => { catalogCache = undefined }
  const sweepReservations = () => { const count = store.expireReservations(); if (count) invalidate(); return count }
  sweepReservations()
  const expiryTimer = setInterval(() => { try { sweepReservations() } catch (error) { logger.error?.('Reservation cleanup failed:',error.message) } },Math.min(60000,Math.max(50,Math.floor(reservationTtlMs/2)))).unref()
  const pageOrders = (url,userId = null) => {
    const readPage = (key,fallback,max) => {
      const input = url.searchParams.get(key)
      if (input === null) return fallback
      if (!/^\d+$/.test(input)) throw new AppError(400,'صفحه‌بندی درست نیست.')
      return valid.integer(Number(input),'صفحه‌بندی',key === 'limit' ? 1 : 0,max)
    }
    const limit = readPage('limit',200,200)
    const offset = readPage('offset',0,1000000)
    const where = userId === null ? '' : ' WHERE user_id=?'
    const args = userId === null ? [] : [userId]
    const total = store.db.prepare(`SELECT COUNT(*) AS count FROM orders${where}`).get(...args).count
    const orders = store.db.prepare(`SELECT * FROM orders${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).all(...args,limit,offset).map(store.order)
    return {orders,pagination:{total,limit,offset,hasMore:offset+orders.length<total}}
  }
  const rateLimit = (key,max,windowMs) => {
    const now = Date.now()
    if (limits.size > 10000) for (const [id,entry] of limits) if (entry.until <= now) limits.delete(id)
    if (limits.size > 20000 && !limits.has(key)) throw new AppError(503,'سرور شلوغ است. کمی بعد تلاش کنید.')
    let entry = limits.get(key)
    if (!entry || entry.until <= now) { entry = {count:0,until:now+windowMs}; limits.set(key,entry) }
    if (++entry.count > max) throw new AppError(429,'درخواست زیاد است. کمی بعد تلاش کنید.')
  }
  const send = (res,status,value,extra = {}) => {
    const bytes = Buffer.from(JSON.stringify(value))
    res.writeHead(status,{ 'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store',...extra })
    res.end(bytes)
  }
  const admin = (user) => { if (!user) throw new AppError(401,'اول وارد شوید.'); if (user.role !== 'admin') throw new AppError(403,'این بخش برای مدیر است.') }
  const checkOrigin = (req) => {
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new AppError(403,'مبدأ درخواست مجاز نیست.')
    const origin = req.headers.origin
    if (!origin) return
    const protocol = secureCookies || (trustProxy && req.headers['x-forwarded-proto'] === 'https') || req.socket.encrypted ? 'https' : 'http'
    const ownOrigin = `${protocol}://${req.headers.host}`
    if (origin !== ownOrigin && !originAllowlist.has(origin)) throw new AppError(403,'مبدأ درخواست مجاز نیست.')
  }
  const writeProduct = (input,id) => {
    const p = valid.product(input)
    const category = store.db.prepare('SELECT id FROM categories WHERE title=?').get(p.category)
    if (!category) throw new AppError(400,'دسته پیدا نشد.')
    const values = [p.name,p.sku,p.brand,p.price,p.oldPrice,category.id,p.label,p.visual,p.color,p.description,p.stock,JSON.stringify(p.vehicles)]
    try {
      if (id) store.db.prepare('UPDATE products SET name=?,sku=?,brand=?,price=?,old_price=?,category_id=?,label=?,visual=?,color=?,description=?,stock=?,vehicles=? WHERE id=?').run(...values,id)
      else id = Number(store.db.prepare('INSERT INTO products(name,sku,brand,price,old_price,category_id,label,visual,color,description,stock,vehicles) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(...values).lastInsertRowid)
    } catch (error) { if (error.message.includes('UNIQUE')) throw new AppError(409,'کد کالا تکراری است.'); throw error }
    invalidate()
    return store.product(store.db.prepare(`${store.productQuery} WHERE p.id=?`).get(id))
  }
  const handler = async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('X-Frame-Options','DENY')
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()')
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
    if (secureCookies || (trustProxy && req.headers['x-forwarded-proto'] === 'https') || req.socket.encrypted) res.setHeader('Strict-Transport-Security','max-age=31536000')
    try {
      const url = new URL(req.url,'http://localhost')
      const path = url.pathname
      const method = req.method
      if (path === '/health/live' && method === 'GET') return send(res,200,{ live:true })
      if (path === '/health/ready' && method === 'GET') { store.db.prepare('SELECT 1').get(); return send(res,200,{ ready:true,staticBuilt:existsSync(resolve(distPath,'index.html')) }) }
      if (!path.startsWith('/api/')) return serveStatic(req,res,path)
      const ip = req.socket.remoteAddress || 'unknown'
      rateLimit(`all:${ip}`,300,60000)
      if (!['GET','HEAD'].includes(method)) checkOrigin(req)
      const user = sessionUser(store,req)
      const cookieSecure = secureCookies || Boolean(req.socket.encrypted) || (trustProxy && req.headers['x-forwarded-proto'] === 'https')
      if (path === '/api/catalog' && method === 'GET') {
        if (!catalogCache) { const value = store.catalog(); catalogCache = {value,etag:`"${sha256(JSON.stringify(value))}"`} }
        if (req.headers['if-none-match'] === catalogCache.etag) { res.writeHead(304,{'ETag':catalogCache.etag,'Cache-Control':'no-cache'}); return res.end() }
        return send(res,200,catalogCache.value,{'ETag':catalogCache.etag,'Cache-Control':'no-cache'})
      }
      if (path === '/api/session' && method === 'GET') return send(res,200,{user})
      if ((path === '/api/auth/register' || path === '/api/auth/login') && method === 'POST') {
        rateLimit(`auth:${ip}`,15,15*60000)
        const input = await body(req)
        const email = valid.email(input.email)
        const password = valid.password(input.password)
        rateLimit(`email:${sha256(email)}`,20,15*60000)
        let row
        if (path.endsWith('/register')) {
          const name = valid.text(input.name,'نام',2,120)
          const passwordHash = await hashPassword(password)
          try { const result = store.db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run(name,email,passwordHash,'customer',new Date().toISOString()); row = store.db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid) }
          catch (error) { if (error.message.includes('UNIQUE')) throw new AppError(409,'ثبت حساب انجام نشد. ایمیل را بررسی کنید.'); throw error }
        } else {
          row = store.db.prepare('SELECT * FROM users WHERE email=?').get(email)
          if (!(await verifyPassword(password,row?.password_hash))) throw new AppError(401,'ایمیل یا رمز درست نیست.')
        }
        const token = createSession(store,row.id)
        return send(res,path.endsWith('/register') ? 201 : 200,{user:publicUser(row)},{'Set-Cookie':sessionCookie(token,cookieSecure)})
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        await body(req)
        const token = sessionToken(req)
        if (token) store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token))
        return send(res,200,{ok:true},{'Set-Cookie':sessionCookie('',cookieSecure)})
      }
      if (path === '/api/quote' && method === 'POST') { const input = await body(req); sweepReservations(); return send(res,200,store.quote(valid.items(input.items))) }
      if (path === '/api/orders' && method === 'POST') {
        rateLimit(`order:${ip}`,20,60000)
        const input = await body(req)
        const idempotencyKey = valid.text(input.idempotencyKey,'کلید سفارش',16,128)
        if (!/^[a-zA-Z0-9_-]+$/.test(idempotencyKey)) throw new AppError(400,'کلید سفارش درست نیست.')
        sweepReservations()
        const result = store.createOrder({items:valid.items(input.items),customer:valid.customer(input.customer),note:valid.text(input.note ?? '','یادداشت',0,1000),idempotencyKey},user?.id ?? null)
        invalidate()
        return send(res,201,{order:result.order,receiptToken:result.receiptToken},result.replayed ? {'Idempotency-Replayed':'true'} : {})
      }
      if (path === '/api/orders' && method === 'GET') {
        if (!user) throw new AppError(401,'اول وارد شوید.')
        sweepReservations()
        return send(res,200,pageOrders(url,user.id))
      }
      const orderMatch = /^\/api\/orders\/([A-Z0-9-]{10,40})$/.exec(path)
      if (orderMatch && method === 'GET') {
        sweepReservations()
        const row = store.db.prepare('SELECT * FROM orders WHERE id=?').get(orderMatch[1])
        const provided = String(req.headers['x-receipt-token'] || '')
        const actual = store.receiptToken(orderMatch[1])
        const validReceipt = /^[A-Za-z0-9_-]{43}$/.test(provided) && timingSafeEqual(Buffer.from(provided),Buffer.from(actual))
        if (!row || !(user && (user.role === 'admin' || user.id === row.user_id)) && !validReceipt) throw new AppError(404,'سفارش پیدا نشد.')
        return send(res,200,{order:store.order(row)})
      }
      if (path === '/api/subscribe' && method === 'POST') {
        rateLimit(`subscribe:${ip}`,5,60000)
        const input = await body(req)
        if (input.consent !== true) throw new AppError(400,'رضایت دریافت خبر لازم است.')
        store.db.prepare('INSERT INTO subscribers(phone,consent_at) VALUES (?,?) ON CONFLICT(phone) DO NOTHING').run(valid.phone(input.phone),new Date().toISOString())
        return send(res,201,{ok:true,message:'شماره ثبت شد. ارسال پیام هنوز فعال نیست.'})
      }
      if (path.startsWith('/api/admin/')) {
        admin(user)
        if (path === '/api/admin/overview' && method === 'GET') {
          sweepReservations()
          const metrics = {revenue:store.db.prepare("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status IN ('paid','processing','shipped','completed')").get().n,orders:store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,lowStock:store.db.prepare('SELECT COUNT(*) AS n FROM products WHERE stock<=5').get().n,customers:store.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='customer'").get().n}
          const cutoff = new Date(); cutoff.setUTCHours(0,0,0,0); cutoff.setUTCDate(cutoff.getUTCDate()-29)
          const reports = {byStatus:store.db.prepare('SELECT status,COUNT(*) AS count,SUM(total) AS total FROM orders GROUP BY status ORDER BY status').all(),byDay:store.db.prepare("SELECT substr(created_at,1,10) AS date,COUNT(*) AS count,SUM(CASE WHEN status IN ('paid','processing','shipped','completed') THEN total ELSE 0 END) AS total FROM orders WHERE created_at>=? GROUP BY substr(created_at,1,10) ORDER BY date").all(cutoff.toISOString())}
          const catalog = store.catalog()
          return send(res,200,{metrics,...pageOrders(url),reports,products:catalog.products,categories:catalog.categories,subscribers:store.db.prepare('SELECT id,phone,consent_at AS consentAt FROM subscribers ORDER BY id DESC LIMIT 200').all()})
        }
        if (path === '/api/admin/orders' && method === 'GET') { sweepReservations(); return send(res,200,pageOrders(url)) }
        if (path === '/api/admin/products' && method === 'POST') return send(res,201,{product:writeProduct(await body(req))})
        const productMatch = /^\/api\/admin\/products\/(\d+)$/.exec(path)
        if (productMatch && method === 'PATCH') {
          const id = valid.integer(Number(productMatch[1]),'شناسه کالا',1,2147483647)
          const existing = store.product(store.db.prepare(`${store.productQuery} WHERE p.id=?`).get(id))
          if (!existing) throw new AppError(404,'کالا پیدا نشد.')
          return send(res,200,{product:writeProduct({...existing,...await body(req)},id)})
        }
        const adminOrderMatch = /^\/api\/admin\/orders\/([A-Z0-9-]{10,40})$/.exec(path)
        if (adminOrderMatch && method === 'PATCH') {
          const input = await body(req)
          const status = valid.text(input.status,'وضعیت',1,30)
          sweepReservations()
          const changed = store.transitionOrder(adminOrderMatch[1],status,user.id)
          invalidate()
          return send(res,200,{order:changed})
        }
        if (path === '/api/admin/categories' && method === 'POST') {
          const input = await body(req)
          const title = valid.text(input.title,'دسته',2,80)
          const icon = valid.text(input.icon,'نشان',1,20)
          if (!valid.visuals.has(icon)) throw new AppError(400,'نشان درست نیست.')
          try { const result = store.db.prepare('INSERT INTO categories(title,icon) VALUES (?,?)').run(title,icon); invalidate(); return send(res,201,{category:{id:Number(result.lastInsertRowid),title,icon,count:0}}) }
          catch (error) { if (error.message.includes('UNIQUE')) throw new AppError(409,'دسته تکراری است.'); throw error }
        }
        if (path === '/api/admin/settings' && method === 'PATCH') {
          const input = await body(req)
          const config = {...store.settings()}
          if ('storeName' in input) config.storeName = valid.text(input.storeName,'نام فروشگاه',2,80)
          if ('shippingFee' in input) config.shippingFee = valid.integer(input.shippingFee,'هزینه ارسال',0,10000000)
          if ('freeShippingThreshold' in input) config.freeShippingThreshold = valid.integer(input.freeShippingThreshold,'مرز ارسال رایگان',1,1000000000)
          if ('contactEmail' in input) config.contactEmail = input.contactEmail === '' ? '' : valid.email(input.contactEmail)
          if ('contactPhone' in input) config.contactPhone = input.contactPhone === '' ? '' : valid.phone(input.contactPhone)
          if ('demo' in input) throw new AppError(400,'خروج از حالت نمونه فقط پس از بررسی کالا و راه‌اندازی انجام شود.')
          store.setSettings(config); invalidate(); return send(res,200,{settings:config})
        }
      }
      throw new AppError(404,'مسیر پیدا نشد.')
    } catch (error) {
      const status = error instanceof AppError ? error.status : 500
      if (status === 500) logger.error?.('Request failed:',error.message)
      if (!res.headersSent) send(res,status,{error:status === 500 ? 'خطای سرور. دوباره تلاش کنید.' : error.message},status === 429 ? {'Retry-After':'60'} : {})
      else res.end()
    }
  }
  function serveStatic(req,res,path) {
    if (!['GET','HEAD'].includes(req.method)) throw new AppError(405,'روش درخواست مجاز نیست.')
    let decoded
    try { decoded = decodeURIComponent(path) } catch { throw new AppError(400,'نشانی درست نیست.') }
    if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some((part) => part.startsWith('.'))) throw new AppError(404,'مسیر پیدا نشد.')
    const base = resolve(distPath)
    let target = resolve(base,`.${decoded}`)
    if (!target.startsWith(base+sep) && target !== base) throw new AppError(404,'مسیر پیدا نشد.')
    if (!extname(target)) {
      if (!(req.headers.accept || '').includes('text/html')) throw new AppError(404,'مسیر پیدا نشد.')
      target = resolve(base,'index.html')
    }
    let stat
    try { stat = statSync(target); const real = realpathSync(target); if (!real.startsWith(realpathSync(base)+sep) || !stat.isFile()) throw new Error('outside root') } catch { throw new AppError(404,'فایل پیدا نشد. ساخت پروژه را اجرا کنید.') }
    let entry = files.get(target)
    if (!entry || entry.mtime !== stat.mtimeMs) {
      const bytes = readFileSync(target)
      const type = MIME[extname(target)] || 'application/octet-stream'
      entry = { bytes,type,mtime:stat.mtimeMs,etag:`"${sha256(bytes)}"`,gzip:bytes.length > 1024 && /(?:text\/|javascript|json|svg)/.test(type) ? gzipSync(bytes) : null }
      if (files.size > 100) files.clear()
      if (bytes.length < 2*1024*1024) files.set(target,entry)
    }
    const headers = {'Content-Type':entry.type,'ETag':entry.etag,'Cache-Control':target.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache','Vary':'Accept-Encoding'}
    if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304,headers); return res.end() }
    const compress = entry.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && !/\bgzip\s*;\s*q=0(?:\D|$)/.test(req.headers['accept-encoding'] || '')
    const bytes = compress ? entry.gzip : entry.bytes
    if (compress) headers['Content-Encoding'] = 'gzip'
    res.writeHead(200,{...headers,'Content-Length':bytes.length})
    res.end(req.method === 'HEAD' ? undefined : bytes)
  }
  const server = createHttpServer(handler)
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  server.keepAliveTimeout = 5000
  server.maxHeadersCount = 60
  return {server,store,handler,async close() { clearInterval(expiryTimer); if (server.listening) await new Promise((done,reject) => { server.close((error) => error ? reject(error) : done()); server.closeIdleConnections() }); store.close() }}
}
