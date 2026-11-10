import { it,expect,vi } from 'vitest'
import { api,ApiError,normalize } from '../../src/api'

it('preserves Headers instances, abort signals and same-origin credentials',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true}),{status:200}))
  vi.stubGlobal('fetch',fetch)
  const controller=new AbortController()
  await expect(api('/quote',{method:'POST',body:'{}',headers:new Headers({'X-Receipt-Token':'test-token'}),signal:controller.signal})).resolves.toEqual({ok:true})
  const [path,options]=fetch.mock.calls[0]
  expect(path).toBe('/api/quote');expect(options.credentials).toBe('same-origin');expect(options.signal.aborted).toBe(false);expect(options.headers.get('X-Receipt-Token')).toBe('test-token');expect(options.headers.get('Content-Type')).toBe('application/json')
  controller.abort()
  expect(options.signal.aborted).toBe(true)
})
it('rejects malformed JSON even on a successful HTTP response',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>bad</html>',{status:200})));await expect(api('/catalog')).rejects.toThrow('پاسخ سرور خوانده نشد')})
it('preserves HTTP error status for recoverable checkout conflicts',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'مبلغ تغییر کرد'}),{status:409})));try{await api('/orders');expect.unreachable()}catch(error){expect(error).toBeInstanceOf(ApiError);expect((error as ApiError).status).toBe(409);expect((error as Error).message).toBe('مبلغ تغییر کرد')}})
it('renders a readable connection failure and normalizes Persian search letters',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('network')));await expect(api('/catalog')).rejects.toThrow('ارتباط با سرور برقرار نشد')})
it('matches Persian, Arabic and Latin digits and letters in part searches',()=>{
  expect(normalize('  فيلتر پژو‌۲۰۶  ')).toBe(normalize('فیلتر پژو 206'))
  expect(normalize('FLT-٢٠٦')).toBe(normalize('flt-206'))
})
it('keeps the fifteen-second deadline when the caller provides its own active signal',async()=>{
  vi.useFakeTimers()
  try {
    const caller=new AbortController(),deadline=new AbortController()
    const timeout=vi.spyOn(AbortSignal,'timeout').mockImplementation(delay=>{
      setTimeout(()=>deadline.abort(new DOMException('Timed out','TimeoutError')),delay)
      return deadline.signal
    })
    let requestSignal!:AbortSignal
    vi.stubGlobal('fetch',vi.fn((_path,options)=>new Promise((_resolve,reject)=>{
      requestSignal=options.signal
      requestSignal.addEventListener('abort',()=>reject(requestSignal.reason),{once:true})
    })))
    const result=api('/quote',{signal:caller.signal})
    const rejected=expect(result).rejects.toThrow('ارتباط با سرور برقرار نشد')
    expect(timeout).toHaveBeenCalledWith(15000)
    await vi.advanceTimersByTimeAsync(14999)
    expect(requestSignal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejected
    expect(caller.signal.aborted).toBe(false)
    expect(requestSignal.aborted).toBe(true)
  } finally {vi.useRealTimers()}
})
it('still aborts a stalled request immediately when its caller cancels',async()=>{
  const caller=new AbortController(),deadline=new AbortController()
  vi.spyOn(AbortSignal,'timeout').mockReturnValue(deadline.signal)
  vi.stubGlobal('fetch',vi.fn((_path,options)=>new Promise((_resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true})
  })))
  const request=api('/orders',{signal:caller.signal})
  const rejected=expect(request).rejects.toThrow('ارتباط با سرور برقرار نشد')
  caller.abort()
  await rejected
  expect(deadline.signal.aborted).toBe(false)
})
