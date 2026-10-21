export class ApiError extends Error {
  constructor(message:string,public status:number){super(message);this.name='ApiError'}
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if(options.body && !headers.has('Content-Type'))headers.set('Content-Type','application/json')
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    signal: options.signal || AbortSignal.timeout(15000),
    headers,
  }).catch(() => { throw new Error('ارتباط با سرور برقرار نشد. اتصال را بررسی و دوباره تلاش کنید.') })
  const result = await response.json().catch(() => {throw new Error('پاسخ سرور خوانده نشد. دوباره تلاش کنید.')})
  if (!response.ok) throw new ApiError(result.error || 'انجام درخواست ممکن نشد.',response.status)
  return result as T
}
export const json = (data: unknown) => JSON.stringify(data)
export const normalize = (value: string) => value.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s]+/g, ' ').trim().toLocaleLowerCase('fa')
