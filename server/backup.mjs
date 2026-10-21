import { resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

let db
try {
  const source = resolve(process.env.DB_PATH || 'server/data/store.sqlite')
  if (!process.argv[2]) throw new Error('Destination required: node server/backup.mjs <path.sqlite>')
  const target = resolve(process.argv[2])
  if (target === source || existsSync(target)) throw new Error('Destination must be a new file.')
  if (!existsSync(source)) throw new Error('Source database missing.')
  mkdirSync(dirname(target),{recursive:true})
  db = new DatabaseSync(source)
  db.exec('PRAGMA busy_timeout=5000')
  db.prepare('VACUUM INTO ?').run(target)
  const check = new DatabaseSync(target,{readOnly:true})
  const result = check.prepare('PRAGMA integrity_check').get()
  check.close()
  if (result.integrity_check !== 'ok') throw new Error('Backup integrity failed.')
  console.log(`Backup ready: ${target}`)
} catch (error) { console.error(error.message); process.exitCode=1 }
finally { db?.close() }
