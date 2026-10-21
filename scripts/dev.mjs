import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const children = []
let closing = false
function stop(code = 0) {
  if (closing) return
  closing = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
for (const args of [['server/index.mjs'], [resolve('node_modules/vite/bin/vite.js')]]) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: {...process.env, ...(args[0]==='server/index.mjs'?{PORT: process.env.API_PORT || '3001'}:{})} })
  children.push(child)
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => { if (!closing) stop(code || 0) })
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
