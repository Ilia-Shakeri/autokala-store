import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {once} from 'node:events'
import {mkdtempSync,rmSync,readdirSync,mkdirSync,copyFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {createStore} from '../server/store.mjs'
import {supportedNode,demoPort,runLocal,sameSite} from '../scripts/run-local.mjs'

const quiet=()=>{}
async function freePort(){
  const server=createServer()
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const port=server.address().port
  await new Promise(done=>server.close(done))
  return port
}

test('launcher rejects unsupported runtimes and unsafe port input',()=>{
  for(const version of ['20.19.0','22.22.9'])assert.equal(supportedNode(version),false)
  for(const version of ['22.23.0','24.1.0'])assert.equal(supportedNode(version),true)
  for(const value of ['0','-1','3001 & echo bad','65536','3.1','03001',''])assert.throws(()=>demoPort(value))
  assert.equal(demoPort('3001'),3001)
})

test('launcher starts loopback demo with sample data and no automatic admin; repeat reuses it',async t=>{
  const result=await runLocal({port:await freePort(),dbPath:':memory:',open:false,build:false,log:quiet})
  t.after(()=>result.app.close())
  assert.equal(result.reused,false)
  assert.equal(result.app.server.address().address,'127.0.0.1')
  const db=result.app.store.db
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,30)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='customer'").get().n,6)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n,0)
  assert.equal(await sameSite(result.port),true)
  const reused=await runLocal({port:result.port,dbPath:':memory:',open:false,build:false,log:quiet})
  assert.equal(reused.reused,true)
  assert.equal(reused.app,null)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,30)
  assert.equal((await fetch(`http://127.0.0.1:${result.port}/api/admin/orders`)).status,404)
})

test('launcher leaves occupied unrelated server alive and selects next free port',async t=>{
  const occupied=createServer((req,res)=>res.end('another service'))
  occupied.listen(0,'127.0.0.1');await once(occupied,'listening')
  t.after(()=>new Promise(done=>occupied.close(done)))
  const port=occupied.address().port
  const result=await runLocal({port,dbPath:':memory:',open:false,build:false,log:quiet})
  t.after(()=>result.app.close())
  assert.equal(result.reused,false)
  assert.ok(result.port>port&&result.port<=port+9)
  assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(),'another service')
})

test('matching health without the current frontend build is never reused',async t=>{
  let port
  const wrong=createServer((req,res)=>{
    res.setHeader('Content-Type','application/json')
    res.end(req.url==='/health/ready'?JSON.stringify({ready:true,staticBuilt:true}):req.url==='/api/context'?JSON.stringify({isAdminHost:false,publicOrigin:`http://127.0.0.1:${port}`}):'old build')
  })
  wrong.listen(0,'127.0.0.1');await once(wrong,'listening');port=wrong.address().port
  t.after(()=>new Promise(done=>wrong.close(done)))
  assert.equal(await sameSite(port),false)
})

test('first demo seed preserves existing data and makes a restorable backup',async t=>{
  const root=mkdtempSync(join(tmpdir(),'autokala-launcher-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  mkdirSync(join(root,'dist'))
  copyFileSync(new URL('../dist/index.html',import.meta.url),join(root,'dist/index.html'))
  const dbPath=join(root,'store.sqlite')
  const store=createStore({dbPath})
  store.db.prepare("INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)").run('Owner','owner@example.test','unusable','admin',new Date().toISOString())
  store.close()
  const result=await runLocal({rootDir:root,port:await freePort(),dbPath,open:false,build:false,log:quiet})
  try{
    assert.equal(result.app.store.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n,1)
    const backups=readdirSync(join(root,'backups'))
    assert.equal(backups.length,1)
    const backup=new DatabaseSync(join(root,'backups',backups[0]),{readOnly:true})
    try{
      assert.equal(backup.prepare('PRAGMA integrity_check').get().integrity_check,'ok')
      assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM users').get().n,1)
      assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM orders').get().n,0)
    }finally{backup.close()}
  }finally{await result.app.close()}
})
