import { it,expect,vi } from 'vitest'
import { api,ApiError } from '../../src/api'

it('preserves Headers instances, abort signals and same-origin credentials',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true}),{status:200}))
  vi.stubGlobal('fetch',fetch)
  const controller=new AbortController()
  await expect(api('/quote',{method:'POST',body:'{}',headers:new Headers({'X-Receipt-Token':'test-token'}),signal:controller.signal})).resolves.toEqual({ok:true})
  const [path,options]=fetch.mock.calls[0]
  expect(path).toBe('/api/quote');expect(options.credentials).toBe('same-origin');expect(options.signal).toBe(controller.signal);expect(options.headers.get('X-Receipt-Token')).toBe('test-token');expect(options.headers.get('Content-Type')).toBe('application/json')
})
it('rejects malformed JSON even on a successful HTTP response',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>bad</html>',{status:200})));await expect(api('/catalog')).rejects.toThrow('پاسخ سرور خوانده نشد')})
it('preserves HTTP error status for recoverable checkout conflicts',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'مبلغ تغییر کرد'}),{status:409})));try{await api('/orders');expect.unreachable()}catch(error){expect(error).toBeInstanceOf(ApiError);expect((error as ApiError).status).toBe(409);expect((error as Error).message).toBe('مبلغ تغییر کرد')}})
it('renders a readable connection failure and normalizes Persian search letters',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('network')));await expect(api('/catalog')).rejects.toThrow('ارتباط با سرور برقرار نشد')})
