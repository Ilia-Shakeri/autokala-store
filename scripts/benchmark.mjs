import { performance } from 'node:perf_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const baseUrl = new URL(process.argv[2] || 'http://127.0.0.1:3001')
if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
  throw new Error('نشانی HTTP بدون اطلاعات ورود لازم است.')
}
const endpoint = new URL('/api/catalog', baseUrl)
const count = Number(process.env.BENCH_REQUESTS || 100)
if (!Number.isInteger(count) || count < 20 || count > 10000) throw new Error('BENCH_REQUESTS باید بین ۲۰ و ۱۰۰۰۰ باشد.')
const samples = []
let responseBytes = 0
let productCount = 0

async function readCatalog(record) {
  const started = performance.now()
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) })
  const body = await response.text()
  if (!response.ok) throw new Error(`کاتالوگ پاسخ ${response.status} داد.`)
  const data = JSON.parse(body)
  if (!Array.isArray(data.products)) throw new Error('ساختار کاتالوگ نادرست است.')
  if (record) samples.push(performance.now() - started)
  responseBytes = Buffer.byteLength(body)
  productCount = data.products.length
}

for (let i = 0; i < 10; i++) await readCatalog(false)
const runStarted = performance.now()
for (let i = 0; i < count; i++) await readCatalog(true)
const durationMs = performance.now() - runStarted
samples.sort((a, b) => a - b)
const percentile = (p) => Number(samples[Math.max(0, Math.ceil(samples.length * p) - 1)].toFixed(3))
const report = {
  measuredAt: new Date().toISOString(),
  endpoint: endpoint.href,
  runtime: process.version,
  method: 'GET; 10 warmups; sequential requests; response body consumed and JSON parsed',
  requests: count,
  concurrency: 1,
  errors: 0,
  productCount,
  responseBytes,
  durationMs: Number(durationMs.toFixed(3)),
  requestsPerSecond: Number((count / durationMs * 1000).toFixed(2)),
  latencyMs: { min: percentile(0), p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: percentile(1) },
  p95BudgetMs: 100,
  p95BudgetMet: percentile(0.95) < 100,
  scope: 'Single-process read API on this host. No browser vitals, internet latency, concurrent checkout load or public-host guarantee.',
}
if (process.argv[3]) {
  const outputPath = resolve(process.argv[3])
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!report.p95BudgetMet) process.exitCode = 1
