import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { sha256, AppError } from './store.mjs'

const scrypt = promisify(scryptCallback)
const sessionDuration = 14 * 24 * 60 * 60 * 1000
const adminSessionDuration = 8 * 60 * 60 * 1000
const cost = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const dummySalt = randomBytes(16).toString('hex')
const dummyHash = `scrypt$16384$8$1$${dummySalt}$${scryptSync(randomBytes(32),dummySalt,64,cost).toString('hex')}`
let activeHashes = 0

async function derive(password, salt) {
  if (activeHashes >= 8) throw new AppError(503,'سرور شلوغ است. کمی بعد تلاش کنید.')
  activeHashes++
  try { return await scrypt(password,salt,64,cost) } finally { activeHashes-- }
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$16384$8$1$${salt}$${(await derive(password,salt)).toString('hex')}`
}
export async function verifyPassword(password, storedHash) {
  const encoded = storedHash || dummyHash
  const parts = encoded.includes(':') ? ['scrypt','16384','8','1',...encoded.split(':')] : encoded.split('$')
  const [algorithm,n,r,p,salt,expected] = parts
  if (parts.length !== 6 || algorithm !== 'scrypt' || n !== '16384' || r !== '8' || p !== '1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expected)) return false
  const candidate = await derive(password,salt)
  const expectedBytes = Buffer.from(expected,'hex')
  return candidate.length === expectedBytes.length && timingSafeEqual(candidate,expectedBytes) && Boolean(storedHash)
}
export function publicUser(row) { return row ? { id: row.id, name: row.name, email: row.email, role: row.role } : null }
export function createSession(store,userId,adminHost = false) {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  store.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now)
  store.db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(sha256(token),userId,now+(adminHost ? adminSessionDuration : sessionDuration))
  return token
}
const cookieName = (adminHost,secure) => `${secure ? '__Host-' : ''}autokala_${adminHost ? 'admin_' : ''}session`
export function sessionToken(req,adminHost = false,secure = false) {
  const cookies = (req.headers.cookie || '').split(';').map((item) => item.trim())
  const name = `${cookieName(adminHost,secure)}=`
  const matching = cookies.filter((item) => item.startsWith(name))
  return matching.length === 1 ? matching[0].slice(name.length) : undefined
}
export function sessionUser(store,req,adminHost = false,secure = false) {
  const token = sessionToken(req,adminHost,secure)
  if (!token || !/^[\w-]{43}$/.test(token)) return null
  return publicUser(store.db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.role=?').get(sha256(token),Date.now(),adminHost ? 'admin' : 'customer'))
}
export function sessionCookie(token,secure = false,adminHost = false) { return `${cookieName(adminHost,secure)}=${token}; HttpOnly; SameSite=${adminHost ? 'Strict' : 'Lax'}; Path=/; Max-Age=${token ? (adminHost ? adminSessionDuration : sessionDuration)/1000 : 0}${secure ? '; Secure' : ''}` }
