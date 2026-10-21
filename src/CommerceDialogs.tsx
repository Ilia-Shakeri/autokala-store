import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, json, ApiError } from './api'
import { Modal } from './Modal'
import { LoadingCar } from './LoadingCar'
import { Select } from './Select'
import { formatPrice } from './ui'
import type { CartItem, Customer, Order, User } from './types'
import { statusLabels } from './types'

type Quote = {subtotal: number; shipping: number; total: number; items: {productId: number; name: string; price: number; quantity: number; lineTotal: number}[]}
type Receipt = {order: Order; receiptToken?: string}
type SavedReceipt = {id: string; token?: string}
function savedReceipts(): SavedReceipt[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('autokala.receipts.v1') || '[]')
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return value.filter((receipt): receipt is SavedReceipt => {
      if (!receipt || typeof receipt !== 'object' || typeof receipt.id !== 'string' || !receipt.id.trim() || receipt.id.length > 80 || seen.has(receipt.id)) return false
      if (receipt.token !== undefined && (typeof receipt.token !== 'string' || receipt.token.length > 256)) return false
      seen.add(receipt.id)
      return true
    }).slice(0, 20)
  } catch { return [] }
}
function OrderCard({ order }: {order: Order}) {
  return <article className="order-receipt"><p><strong>شماره سفارش</strong><b dir="ltr">{order.id}</b></p><p>وضعیت <strong>{statusLabels[order.status] || order.status}</strong></p><p>زمان ثبت <span>{new Date(order.createdAt).toLocaleString('fa-IR',{timeZone:'Asia/Tehran'})}</span></p>{order.items.map(item => <p key={item.productId}>{item.name} × {item.quantity.toLocaleString('fa-IR')}<span>{formatPrice(item.lineTotal)} تومان</span></p>)}<p>ارسال <span>{formatPrice(order.shipping)} تومان</span></p><p><strong>جمع سفارش</strong><strong>{formatPrice(order.total)} تومان</strong></p>{order.status === 'pending_payment' && order.expiresAt && <p>پایان مهلت رزرو <span>{new Date(order.expiresAt).toLocaleString('fa-IR',{timeZone:'Asia/Tehran'})}</span></p>}</article>
}

export function CheckoutDialog({items, user, onClose, onComplete}: {items: CartItem[]; user: User | null; onClose: () => void; onComplete: () => void}) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [customer, setCustomer] = useState<Customer>({name: user?.name || '',email: user?.email || '',phone:'',address:'',postalCode:''})
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const key = useRef(crypto.randomUUID())
  const completed = useRef(false)
  const [quoteAttempt, setQuoteAttempt] = useState(0)
  useEffect(() => { let active = true; setError(''); api<Quote>('/quote', {method:'POST',body:json({items})}).then(value => {if(active) setQuote(value)}).catch(e => {if(active) setError(e.message)}); return () => {active = false} }, [items, quoteAttempt])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !quote || completed.current) return
    setBusy(true); setError('')
    try {
      const result = await api<Receipt>('/orders', {method:'POST',body:json({items,customer,note,idempotencyKey:key.current,expectedTotal:quote.total})})
      setReceipt(result); completed.current = true
      try { const saved = JSON.parse(localStorage.getItem('autokala.receipts.v1') || '[]'); localStorage.setItem('autokala.receipts.v1',JSON.stringify([{id:result.order.id,token:result.receiptToken},...(Array.isArray(saved) ? saved : [])].slice(0,20))) } catch { /* Receipt remains visible when storage is unavailable. */ }
      onComplete()
    } catch(e) { setError((e as Error).message);if(e instanceof ApiError && e.status===409)setQuote(null) } finally { setBusy(false) }
  }
  const field = (key: keyof Customer, value: string) => setCustomer(current => ({...current,[key]:value}))
  return <Modal title={receipt ? 'رسید سفارش' : 'تکمیل سفارش'} onClose={() => { if(!busy) onClose() }}>
    {receipt ? <><div className="success-note" role="status">سفارش ثبت شد. پرداخت هنوز انجام نشده است.</div><OrderCard order={receipt.order} />{receipt.receiptToken && <div className="receipt-key"><strong>کلید محرمانه پیگیری</strong><code dir="ltr">{receipt.receiptToken}</code><p>شماره سفارش و کلید را نگه دارید. کلید را با دیگران به اشتراک نگذارید.</p><button type="button" onClick={() => {const data = new Blob([JSON.stringify(receipt,null,2)], {type:'application/json'}); const url=URL.createObjectURL(data); const a=document.createElement('a');a.href=url;a.download=`receipt-${receipt.order.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>دریافت رسید</button></div>}<p className="muted-note">درگاه پرداخت، روش ارسال و اطلاعات تماس هنوز تنظیم نشده‌اند. این نسخه برای بررسی مسیر سفارش است.</p></> : <form onSubmit={submit}>
      <p className="demo-note">ثبت آزمایشی سفارش؛ وجهی دریافت نمی‌شود. قیمت و موجودی نمونه‌اند.</p>
      <div className="form-grid">
        <label>نام و نام خانوادگی<input autoComplete="name" required minLength={3} maxLength={100} value={customer.name} onChange={e=>field('name',e.target.value)} placeholder="نام کامل گیرنده سفارش" /></label>
        <label>موبایل گیرنده<input autoComplete="tel" inputMode="tel" required maxLength={16} value={customer.phone} onChange={e=>field('phone',e.target.value)} placeholder="شماره موبایل با ۰۹" /></label>
        <label>ایمیل رسید<input autoComplete="email" type="email" required maxLength={180} value={customer.email} onChange={e=>field('email',e.target.value)} placeholder="name@example.com" dir="ltr" /></label>
        <label>کد پستی<input autoComplete="postal-code" inputMode="numeric" required maxLength={10} minLength={10} value={customer.postalCode} onChange={e=>field('postalCode',e.target.value)} placeholder="کد پستی ۱۰ رقمی" /></label>
      </div>
      <label className="description-field">نشانی کامل<textarea autoComplete="street-address" required minLength={15} maxLength={1000} value={customer.address} onChange={e=>field('address',e.target.value)} placeholder="استان، شهر، خیابان، کوچه، پلاک و واحد" /></label>
      <label className="description-field">یادداشت سفارش، اختیاری<textarea maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="زمان مناسب هماهنگی یا نکته لازم درباره تحویل" /></label>
      {!quote&&!error&&<LoadingCar label="در حال دریافت مبلغ سفارش…"/>}{quote && <div className="order-receipt"><p>جمع کالاها <span>{formatPrice(quote.subtotal)} تومان</span></p><p>ارسال نمونه <span>{formatPrice(quote.shipping)} تومان</span></p><p><strong>جمع سفارش</strong><strong>{formatPrice(quote.total)} تومان</strong></p></div>}
      {error && <p className="form-error" role="alert">{error}{!quote && <button type="button" onClick={()=>setQuoteAttempt(value=>value+1)}>دریافت دوباره مبلغ</button>}</p>}
      <p className="muted-note">مبلغ و موجودی هنگام ثبت، دوباره در سرور بررسی می‌شوند. سفارش بی‌پرداخت پس از ۲۴ ساعت لغو و رزرو کالا آزاد می‌شود. درگاه پرداخت و روش ارسال در انتظار تنظیم‌اند.</p>
      <div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>بازگشت</button><button disabled={busy || !quote}>{busy ? <LoadingCar inline label="در حال ثبت…"/> : 'ثبت سفارش در انتظار پرداخت'}</button></div>
    </form>}
  </Modal>
}

export function AccountDialog({user,adminRequested,onClose,onAuthenticated,onLogout}: {user: User | null; adminRequested: boolean; onClose:()=>void; onAuthenticated:(user:User)=>void; onLogout:()=>void}) {
  const [mode, setMode] = useState<'login'|'register'|'track'>(user ? 'track' : 'login')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [orders,setOrders] = useState<Order[]>([])
  const [ordersLoading,setOrdersLoading] = useState(Boolean(user))
  const [hasMore,setHasMore] = useState(false)
  const [tracked,setTracked] = useState<Order | null>(null)
  const [id,setId] = useState('')
  const [token,setToken] = useState('')
  const [savedReceipt,setSavedReceipt] = useState('')
  const [saved] = useState(savedReceipts)
  useEffect(() => {let active=true;setOrders([]);setHasMore(false);setOrdersLoading(Boolean(user));if(user)void api<{orders:Order[];pagination:{hasMore:boolean}}>('/orders?limit=50').then(result=>{if(active){setOrders(result.orders);setHasMore(result.pagination.hasMore)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setOrdersLoading(false)});return()=>{active=false}}, [user])
  const moreOrders = async () => {if(busy)return;setBusy(true);setError('');try{const result=await api<{orders:Order[];pagination:{hasMore:boolean}}>(`/orders?limit=50&offset=${orders.length}`);setOrders(current=>[...current,...result.orders]);setHasMore(result.pagination.hasMore)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if(busy)return;setBusy(true);setError('')
    const data = new FormData(event.currentTarget)
    try {const result = await api<{user:User}>(`/auth/${mode}`,{method:'POST',body:json(Object.fromEntries(data))});onAuthenticated(result.user)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  const track = async (event:FormEvent) => {event.preventDefault();if(busy)return;setBusy(true);setError('');setTracked(null);try{const result=await api<{order:Order}>(`/orders/${encodeURIComponent(id)}`,{headers:{'X-Receipt-Token':token}});setTracked(result.order)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <Modal title={user ? `حساب ${user.name}` : adminRequested ? 'ورود مدیر فروشگاه' : 'حساب و پیگیری سفارش'} onClose={onClose}>
    <div className="filter-pills dialog-tabs">{!user && <><button onClick={()=>{setMode('login');setError('')}} className={mode==='login'?'active':''}>ورود</button><button onClick={()=>{setMode('register');setError('')}} className={mode==='register'?'active':''}>ساخت حساب</button></>}<button onClick={()=>{setMode('track');setError('')}} className={mode==='track'?'active':''}>پیگیری سفارش</button></div>
    {!user && mode!=='track' && <form onSubmit={submit}><div className="form-grid">{mode==='register'&&<label>نام کامل<input required name="name" autoComplete="name" minLength={3} maxLength={100} placeholder="نام و نام خانوادگی" /></label>}<label>ایمیل<input required name="email" type="email" dir="ltr" autoComplete="username" placeholder="name@example.com" /></label><label>رمز عبور<input required name="password" type="password" minLength={12} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} placeholder="حداقل ۱۲ نویسه" /></label></div><div className="modal-actions"><button disabled={busy}>{busy?<LoadingCar inline label="در حال بررسی…"/>:mode==='login'?'ورود به حساب':'ساخت حساب'}</button></div>{adminRequested&&<p className="muted-note">حساب مدیر با فرمان محلی ساخته می‌شود. حساب تازه، دسترسی مدیریت ندارد.</p>}</form>}
    {(mode==='track'||user)&&<><form onSubmit={track}><div className="form-grid"><label>شماره سفارش<input required value={id} onChange={e=>setId(e.target.value)} dir="ltr" placeholder="شماره روی رسید" /></label><label>کلید پیگیری<input value={token} onChange={e=>setToken(e.target.value)} dir="ltr" placeholder="کلید محرمانه روی رسید" /></label></div><div className="modal-actions"><button disabled={busy}>{busy?<LoadingCar inline label="در حال دریافت…"/>:'نمایش سفارش'}</button></div></form>{saved.length>0&&<label className="description-field">رسیدهای این دستگاه<Select label="رسیدهای این دستگاه" value={savedReceipt} placeholder="انتخاب رسید ذخیره‌شده" options={saved.map(r=>({value:r.id,label:r.id}))} onValueChange={value=>{setSavedReceipt(value);const receipt=saved.find(r=>r.id===value);if(receipt){setId(receipt.id);setToken(receipt.token||'')}}}/></label>}{tracked&&<OrderCard order={tracked} />}{user&&<><h3>سفارش‌های حساب</h3>{ordersLoading?<LoadingCar label="در حال دریافت سفارش‌ها…"/>:orders.length?orders.map(order=><OrderCard order={order} key={order.id}/>):<p className="muted-note">هنوز سفارشی با این حساب ثبت نشده است.</p>}</>}</>}
    {hasMore&&<div className="modal-actions"><button onClick={moreOrders} disabled={busy}>{busy?<LoadingCar inline label="در حال دریافت سفارش‌ها…"/>:"سفارش‌های بیشتر"}</button></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}{user&&<div className="modal-actions"><button onClick={()=>{onLogout();onClose()}}>خروج از حساب</button></div>}
  </Modal>
}
