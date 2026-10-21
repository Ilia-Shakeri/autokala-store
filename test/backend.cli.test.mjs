import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { createStore } from '../server/store.mjs'
import { createSession, verifyPassword } from '../server/auth.mjs'

const execute = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)),'..')

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(),'autokala-cli-'))
  const dbPath = join(directory,'store.sqlite')
  const passwordPath = join(directory,'password.txt')
  const password = `temporary-${randomUUID()}`
  const stores = []
  t.after(async () => {
    for (const store of stores) store.close()
    const target = resolve(directory)
    assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}autokala-cli-`))
    await rm(target,{recursive:true,force:true})
  })
  await writeFile(passwordPath,password,{mode:0o600})
  const run = (script,args = []) => execute(process.execPath,[resolve(root,'server',script),...args],{cwd:root,env:{...process.env,DB_PATH:dbPath,ADMIN_PASSWORD_FILE:passwordPath},maxBuffer:1024*1024,timeout:45000})
  const open = () => { const store = createStore({dbPath}); stores.push(store); return store }
  return {directory,dbPath,passwordPath,password,run,open}
}

test('admin command creates only a hashed account and intentional reset revokes old sessions', async t => {
  const f = await fixture(t)
  const args = ['--email','operator@example.test','--name','مدیر آزمون']
  const first = await f.run('admin.mjs',args)
  assert.equal(`${first.stdout}${first.stderr}`.includes(f.password),false)
  const store = f.open()
  const user = store.db.prepare('SELECT * FROM users WHERE email=?').get('operator@example.test')
  assert.equal(user.role,'admin')
  assert.equal(await verifyPassword(f.password,user.password_hash),true)
  assert.equal(user.password_hash.includes(f.password),false)
  createSession(store,user.id,true)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1)
  await assert.rejects(() => f.run('admin.mjs',args),error => /Account exists/.test(error.stderr))
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1)
  const nextPassword = `replacement-${randomUUID()}`
  await writeFile(f.passwordPath,nextPassword,{mode:0o600})
  const reset = await f.run('admin.mjs',[...args,'--reset'])
  assert.equal(`${reset.stdout}${reset.stderr}`.includes(nextPassword),false)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0)
  const next = store.db.prepare('SELECT * FROM users WHERE id=?').get(user.id)
  assert.equal(await verifyPassword(nextPassword,next.password_hash),true)
  assert.equal(await verifyPassword(f.password,next.password_hash),false)
})

test('admin command rejects password arguments and oversized password files', async t => {
  const f = await fixture(t)
  const args = ['--email','operator@example.test','--name','مدیر آزمون']
  await assert.rejects(() => f.run('admin.mjs',[...args,'--password','unused-value']),error => /no password arguments/.test(error.stderr))
  await writeFile(f.passwordPath,'x'.repeat(1025))
  await assert.rejects(() => f.run('admin.mjs',args),error => /Password file too large/.test(error.stderr))
  assert.equal(f.open().db.prepare('SELECT COUNT(*) AS n FROM users').get().n,0)
})

test('backup command copies current WAL data and refuses to replace either database', async t => {
  const f = await fixture(t)
  const store = f.open()
  const order = store.createOrder({items:[{productId:1,quantity:2}],customer:{name:'خریدار آزمون',email:'buyer@example.test',phone:'09123456789',address:'تهران، نشانی آزمون، پلاک ۴',postalCode:'1234567890'},note:'Backup regression',idempotencyKey:'backup-order-regression'}).order
  const target = join(f.directory,'backup.sqlite')
  await f.run('backup.mjs',[target])
  const backup = new DatabaseSync(target,{readOnly:true})
  try {
    assert.equal(backup.prepare('PRAGMA integrity_check').get().integrity_check,'ok')
    assert.equal(backup.prepare('SELECT total FROM orders WHERE id=?').get(order.id).total,order.total)
    assert.equal(backup.prepare('SELECT stock FROM products WHERE id=1').get().stock,store.catalog().products[0].stock)
    assert.equal(backup.prepare("SELECT value FROM meta WHERE key='receipt_secret'").get().value,store.db.prepare("SELECT value FROM meta WHERE key='receipt_secret'").get().value)
  } finally { backup.close() }
  const before = await readFile(target)
  await assert.rejects(() => f.run('backup.mjs',[target]),error => /new file/.test(error.stderr))
  await assert.rejects(() => f.run('backup.mjs',[f.dbPath]),error => /new file/.test(error.stderr))
  assert.deepEqual(await readFile(target),before)
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1)
})
