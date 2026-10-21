import { createApp } from './app.mjs'

const port = Number(process.env.PORT || 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT invalid')
const host = process.env.HOST || '127.0.0.1'
const app = createApp()
app.server.listen(port,host,() => console.log(`Store ready: http://${host}:${port}`))
app.server.on('error',(error) => { console.error(error.message); app.store.close(); process.exitCode = 1 })
let closing = false
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async () => {
  if (closing) return
  closing = true
  const timer = setTimeout(() => process.exit(1),10000).unref()
  try { await app.close(); clearTimeout(timer); process.exitCode = 0 } catch (error) { console.error(error.message); process.exitCode = 1 }
})
