import { isIP } from 'node:net'
import { AppError } from './store.mjs'

function authority(value) {
  if (typeof value !== 'string' || value.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[::1\])(?::[1-9]\d{0,4})?$/i.test(value)) return null
  const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(value)
  if (!match || (match[2] && Number(match[2]) > 65535)) return null
  const hostname = match[1].toLowerCase()
  if (hostname.includes('..') || hostname.split('.').some(label => label.startsWith('-') || label.endsWith('-') || label.length > 63)) return null
  return { hostname, port: match[2] ? String(Number(match[2])) : null }
}

export function createHostBoundary({ publicHost, adminHost, production, secureCookies }) {
  if (production && (!publicHost || !adminHost || !secureCookies)) throw new Error('Production requires PUBLIC_HOST, ADMIN_HOST and SECURE_COOKIES=true.')
  const publicAuthority = authority(publicHost || '127.0.0.1')
  const adminAuthority = authority(adminHost || 'localhost')
  if (!publicAuthority || !adminAuthority || publicAuthority.hostname === adminAuthority.hostname) throw new Error('PUBLIC_HOST and ADMIN_HOST must be valid, distinct hostnames; ports alone do not isolate cookies.')
  const local = ({ hostname }) => hostname === 'localhost' || hostname.endsWith('.localhost') || Boolean(isIP(hostname.replace(/^\[|\]$/g,''))) || !hostname.includes('.')
  if (production && (local(publicAuthority) || local(adminAuthority))) throw new Error('Production requires separate public and admin DNS hostnames.')
  const matches = (input, expected) => input.hostname === expected.hostname && (expected.port ? input.port === expected.port || (expected.port === '443' && !input.port && secureCookies) : !production || !input.port || input.port === '443')
  return (req, protocol) => {
    const input = authority(req.headers.host)
    if (!input) throw new AppError(421,'میزبان درخواست مجاز نیست.')
    const isAdminHost = matches(input,adminAuthority)
    if (!isAdminHost && !matches(input,publicAuthority)) throw new AppError(421,'میزبان درخواست مجاز نیست.')
    const port = publicAuthority.port || (!production ? input.port : null)
    const publicOrigin = `${protocol}://${publicAuthority.hostname}${port && !(protocol === 'https' && port === '443') && !(protocol === 'http' && port === '80') ? `:${port}` : ''}`
    return { isAdminHost, publicOrigin }
  }
}
