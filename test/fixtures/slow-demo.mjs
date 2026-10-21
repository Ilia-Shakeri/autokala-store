import {runLocal} from '../../scripts/run-local.mjs'

// Isolated visual checks: slow responses make pending states observable.
const result = await runLocal({port: Number(process.env.QA_PORT || 3002), dbPath: ':memory:', build: false, open: false})
if (result.reused) throw Error('The QA port is already serving this site. Choose another QA_PORT.')
const {app} = result
app.server.removeAllListeners('request')
app.server.on('request', (req, res) => {
  if (req.method === 'POST') setTimeout(() => app.handler(req, res), 2000)
  else app.handler(req, res)
})
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void app.close())
console.log('QA only: POST responses delayed 2000ms. Database is in memory. No real payments.')
