import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { api, json } from './api'
import type { CartItem, Catalog, User } from './types'
import Storefront from './Storefront'
import { AccountDialog } from './CommerceDialogs'

const AdminPanel = lazy(() => import('./AdminPanel'))
const readCart = (): CartItem[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('autokala.cart.v1') || '[]')
    if (!Array.isArray(value)) return []
    const combined = new Map<number, number>()
    for (const item of value) if (item && typeof item === 'object' && Number.isSafeInteger(item.productId) && item.productId > 0 && Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99) combined.set(item.productId, Math.min(99, (combined.get(item.productId) || 0) + item.quantity))
    return [...combined].slice(0, 50).map(([productId, quantity]) => ({productId, quantity}))
  } catch { return [] }
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'store' | 'admin'>('store')
  const [account, setAccount] = useState(false)
  const [wantsAdmin, setWantsAdmin] = useState(false)
  const [cart, setCart] = useState(readCart)
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const notify = useCallback((message: string) => { setToast(message); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3500) }, [])
  const loadCatalog = useCallback(async () => {
    try { setCatalog(await api<Catalog>('/catalog')); setError('') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'ارتباط با فروشگاه برقرار نشد.') }
  }, [])
  useEffect(() => {
    void loadCatalog()
    api<{user: User | null}>('/session').then(result => setUser(result.user)).catch(() => {})
    return () => clearTimeout(timer.current)
  }, [loadCatalog])
  useEffect(() => { try { localStorage.setItem('autokala.cart.v1', JSON.stringify(cart)) } catch { /* Storage can be unavailable in private browsing. */ } }, [cart])
  const openAdmin = () => { if (user?.role === 'admin') setView('admin'); else { setWantsAdmin(true); setAccount(true) } }
  const authenticated = (next: User) => { setUser(next); setAccount(false); if (wantsAdmin && next.role === 'admin') setView('admin'); setWantsAdmin(false) }
  const logout = async () => { try { await api('/auth/logout', {method: 'POST', body: json({})}); setUser(null); setView('store'); notify('از حساب خارج شدید.') } catch (e) { notify((e as Error).message) } }
  if (!catalog) return <main className="boot-state" dir="rtl"><h1>اتوکالا</h1>{error ? <><p role="alert">{error}</p><button onClick={loadCatalog}>تلاش دوباره</button><p>سرور فروشگاه باید روشن باشد.</p></> : <p role="status">در حال دریافت کالاها…</p>}</main>
  return <>
    {view === 'admin' && user?.role === 'admin' ? <Suspense fallback={<p className="boot-state">در حال باز کردن مدیریت…</p>}><AdminPanel user={user} onStore={() => {setView('store'); void loadCatalog()}} onLogout={logout} onCatalogChange={loadCatalog} /></Suspense> : <Storefront catalog={catalog} cart={cart} setCart={setCart} user={user} onAdmin={openAdmin} onAccount={() => {setWantsAdmin(false); setAccount(true)}} onRefresh={loadCatalog} notify={notify} />}
    {account && <AccountDialog user={user} adminRequested={wantsAdmin} onClose={() => setAccount(false)} onAuthenticated={authenticated} onLogout={logout} />}
    {error && <div className="connection-error" role="alert">{error}<button onClick={loadCatalog}>تلاش دوباره</button></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>
}
