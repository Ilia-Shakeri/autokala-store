import { createInterface, emitKeypressEvents } from 'node:readline'
import { readFileSync, statSync } from 'node:fs'
import { createStore } from './store.mjs'
import { hashPassword } from './auth.mjs'
import * as valid from './validation.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index+1] : undefined
}

async function hiddenInput(label) {
  if (!process.stdin.isTTY) throw new Error('Interactive terminal or ADMIN_PASSWORD_FILE required.')
  process.stdout.write(label)
  emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  return new Promise((resolve,reject) => {
    let value = ''
    const finish = () => { process.stdin.removeListener('keypress',key); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n') }
    const key = (str,info = {}) => {
      if (info.ctrl && info.name === 'c') { finish(); reject(new Error('Cancelled.')); return }
      if (info.name === 'return' || info.name === 'enter') { finish(); resolve(value); return }
      if (info.name === 'backspace') { value = [...value].slice(0,-1).join(''); return }
      if (!info.ctrl && !info.meta && str && !/[\u0000-\u001f\u007f]/u.test(str)) value += str
    }
    process.stdin.on('keypress',key)
  })
}

let store
try {
  if (process.argv.includes('--password')) throw new Error('Use hidden prompt or ADMIN_PASSWORD_FILE; no password arguments.')
  let name = option('--name')
  let email = option('--email')
  if (!name || !email) {
    if (!process.stdin.isTTY) throw new Error('--email and --name required in non-interactive mode.')
    const input = createInterface({input:process.stdin,output:process.stdout})
    const ask = (prompt) => new Promise((done) => input.question(prompt,done))
    name ||= await ask('Admin name: ')
    email ||= await ask('Admin email: ')
    input.close()
  }
  name = valid.text(name,'نام',2,120)
  email = valid.email(email)
  let password
  if (process.env.ADMIN_PASSWORD_FILE) {
    if (statSync(process.env.ADMIN_PASSWORD_FILE).size > 1024) throw new Error('Password file too large.')
    password = readFileSync(process.env.ADMIN_PASSWORD_FILE,'utf8').replace(/^\uFEFF/,'').replace(/\r?\n$/,'')
  } else {
    password = await hiddenInput('Password (hidden, 12 to 128 chars): ')
    const confirm = await hiddenInput('Repeat password: ')
    if (password !== confirm) throw new Error('Passwords differ.')
  }
  password = valid.password(password)
  const hash = await hashPassword(password)
  store = createStore()
  const existing = store.db.prepare('SELECT id FROM users WHERE email=?').get(email)
  if (existing) {
    if (!process.argv.includes('--reset')) throw new Error('Account exists. Use --reset only for an intended local admin reset.')
    store.transaction(() => {
      store.db.prepare("UPDATE users SET name=?,password_hash=?,role='admin' WHERE id=?").run(name,hash,existing.id)
      store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id)
    })
  } else store.db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run(name,email,hash,'admin',new Date().toISOString())
  console.log('Admin account ready. Password not stored as text.')
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { store?.close() }
