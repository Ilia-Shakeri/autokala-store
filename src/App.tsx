import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { api, json } from './api'
import type { CartItem, Catalog, HostContext, User } from './types'
import Storefront from './Storefront'
import { AccountDialog } from './CommerceDialogs'
import AdminLogin from './AdminLogin'
import { loadCart, saveCart } from './storage'

const AdminPanel = lazy(() => import('./AdminPanel'))

export default function App() {
  const [context, setContext] = useState<HostContext | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [account, setAccount] = useState(false)
  const [cart, setCart] = useState<CartItem[]>(loadCart)
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const request = useRef(0)
  const notify = useCallback((message: string) => { setToast(message); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4000) }, [])
  const loadCatalog = useCallback(async () => {
    try { setCatalog(await api<Catalog>('/catalog')); setError('') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'ارتباط با فروشگاه برقرار نشد.') }
  }, [])
  const bootstrap = useCallback(async () => {
    const id = ++request.current
    setError('')
    try {
      const [host, session] = await Promise.all([api<HostContext>('/context'), api<{user:User | null}>('/session')])
      if(id !== request.current)return
      setContext(host);setUser(host.isAdminHost ? session.user?.role==='admin'?session.user:null : session.user?.role==='customer'?session.user:null)
      if(!host.isAdminHost) await loadCatalog()
    } catch(failure) {if(id === request.current)setError((failure as Error).message)}
  }, [loadCatalog])
  useEffect(() => {void bootstrap(); return () => {request.current++;clearTimeout(timer.current)}}, [bootstrap])
  useEffect(() => { saveCart(cart) }, [cart])
  const logout = async () => {
    try { await api('/auth/logout', {method:'POST',body:json({})});setUser(null);setAccount(false);notify('از حساب خارج شدید.') }
    catch(e) {notify((e as Error).message)}
  }
  if(!context || (!context.isAdminHost && !catalog))return <main className="boot-state" dir="rtl"><h1>اتوکالا</h1>{error?<><p role="alert">{error}</p><button onClick={bootstrap}>تلاش دوباره</button></>:<p role="status">در حال دریافت فروشگاه…</p>}</main>
  return <>
    {context.isAdminHost ? user?.role === 'admin' ? <Suspense fallback={<p className="boot-state" role="status">در حال باز کردن مدیریت…</p>}><AdminPanel user={user} onStore={()=>window.location.assign(context.publicOrigin)} onLogout={logout} onCatalogChange={()=>{}}/></Suspense> : <AdminLogin onAuthenticated={setUser} publicOrigin={context.publicOrigin}/> : <Storefront catalog={catalog!} cart={cart} setCart={setCart} user={user} onAccount={()=>setAccount(true)} onRefresh={loadCatalog} notify={notify}/>}
    {account && !context.isAdminHost && <AccountDialog user={user} adminRequested={false} onClose={()=>setAccount(false)} onAuthenticated={next=>{setUser(next);setAccount(false)}} onLogout={logout}/>}
    {error && <div className="connection-error" role="alert">{error}<button onClick={loadCatalog}>تلاش دوباره</button></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>
}
