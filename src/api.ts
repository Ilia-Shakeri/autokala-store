export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  }).catch(() => { throw new Error('ارتباط با سرور برقرار نشد. اتصال را بررسی و دوباره تلاش کنید.') })
  const result = await response.json().catch(() => ({ error: 'پاسخ سرور خوانده نشد. دوباره تلاش کنید.' }))
  if (!response.ok) throw new Error(result.error || 'انجام درخواست ممکن نشد.')
  return result as T
}
export const json = (data: unknown) => JSON.stringify(data)
export const normalize = (value: string) => value.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s]+/g, ' ').trim().toLocaleLowerCase('fa')
