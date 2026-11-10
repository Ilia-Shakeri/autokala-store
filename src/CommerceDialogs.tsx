import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { api, json, ApiError } from './api'
import { Modal } from './Modal'
import { LoadingCar } from './LoadingCar'
import { Select } from './Select'
import { ActionButton } from './ActionButton'
import { formatPrice, Icon } from './ui'
import type { CartItem, Customer, Order, User, Product } from './types'
import { statusLabels } from './types'
import { phoneIssue, postalIssue } from './customer-validation'
import { sanitizeCart } from './storage'
import { ProductImage } from './ProductImage'
import { CartNumber } from './cart-motion'
import { useCheckoutMotion } from './checkout-motion'
import './checkout.css'

type Quote = {subtotal: number; shipping: number; total: number; items: {productId: number; name: string; price: number; quantity: number; lineTotal: number}[]}
type Receipt = {order: Order; receiptToken?: string}
type Submission = {body:{items:CartItem[];customer:Customer;note:string;idempotencyKey:string;expectedTotal:number};quote:Quote;ownerId:number|null}
const pendingStorageKey='autokala.pending-order.v1'
function restoredSubmission():Submission|null{
  try{
    const stored=sessionStorage.getItem(pendingStorageKey)
    if(!stored)return null
    if(stored.length>100000)throw new Error('Oversized request')
    const value=JSON.parse(stored)
    const body=value?.body,quote=value?.quote,customer=body?.customer
    const text=(entry:unknown,min:number,max:number)=>typeof entry==='string'&&entry.trim().length>=min&&entry.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(entry)
    const money=(entry:unknown)=>Number.isSafeInteger(entry)&&Number(entry)>=0
    if(!body||!quote||!customer||!Array.isArray(body.items)||!body.items.length||body.items.length>50||JSON.stringify(sanitizeCart(body.items))!==JSON.stringify(body.items))throw new Error('Invalid basket')
    if(!text(customer.name,2,120)||!text(customer.email,5,254)||!text(customer.phone,10,30)||phoneIssue(customer.phone)||!text(customer.address,10,1000)||!text(customer.postalCode,10,10)||postalIssue(customer.postalCode))throw new Error('Invalid customer')
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)||!text(body.note,0,500)||!text(body.idempotencyKey,16,128)||!/^[a-zA-Z0-9_-]+$/.test(body.idempotencyKey)||!money(body.expectedTotal)||body.expectedTotal<1)throw new Error('Invalid request')
    if(value.ownerId!==null&&(!Number.isSafeInteger(value.ownerId)||value.ownerId<1))throw new Error('Invalid owner')
    if(!money(quote.subtotal)||!money(quote.shipping)||!money(quote.total)||quote.total!==body.expectedTotal||quote.subtotal+quote.shipping!==quote.total||!Array.isArray(quote.items)||quote.items.length!==body.items.length)throw new Error('Invalid quote')
    if(quote.items.some((item:Quote['items'][number])=>!item||!text(item.name,1,1000)||!money(item.price)||!money(item.lineTotal)||item.lineTotal!==item.price*item.quantity||!body.items.some((entry:CartItem)=>entry.productId===item.productId&&entry.quantity===item.quantity))||new Set(quote.items.map((item:Quote['items'][number])=>item.productId)).size!==quote.items.length||quote.items.reduce((sum:number,item:Quote['items'][number])=>sum+item.lineTotal,0)!==quote.subtotal)throw new Error('Invalid quote items')
    return value as Submission
  }catch{try{sessionStorage.removeItem(pendingStorageKey)}catch{/* This visit can still recover its in-memory request. */}return null}
}
let pendingSubmission:Submission|null=restoredSubmission()
export function hasPendingOrder(){return Boolean(pendingSubmission||restoredSubmission())}
const warnPendingSubmission=(event:BeforeUnloadEvent)=>{if(pendingSubmission){event.preventDefault();event.returnValue=''}}
function rememberSubmission(value:Submission|null){
  pendingSubmission=value
  let saved=false
  try{if(value){sessionStorage.setItem(pendingStorageKey,JSON.stringify(value));saved=true}else sessionStorage.removeItem(pendingStorageKey)}catch{/* A blocked session store falls back to the current visit. */}
  if(value&&!saved)window.addEventListener('beforeunload',warnPendingSubmission)
  else window.removeEventListener('beforeunload',warnPendingSubmission)
  return saved
}
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

export function CheckoutDialog({items, user, onClose, onComplete, products = []}: {products?: Product[]; items: CartItem[]; user: User | null; onClose: () => void; onComplete: (items:CartItem[]) => void}) {
  const [resumed]=useState(()=>pendingSubmission||restoredSubmission())
  const submission=useRef<Submission|null>(resumed)
  const [uncertain,setUncertain]=useState(Boolean(resumed))
  const [storageLimited,setStorageLimited]=useState(false)
  const [quote, setQuote] = useState<Quote | null>(resumed?.quote||null)
  const [customer, setCustomer] = useState<Customer>(resumed?.body.customer||{name: user?.name || '',email: user?.email || '',phone:'',address:'',postalCode:''})
  const [note, setNote] = useState(resumed?.body.note||'')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const surface = useRef<HTMLDivElement>(null)
  const {closing, requestClose} = useCheckoutMotion(surface, Boolean(receipt), busy, onClose)
  const locked = busy || closing
  const [noteOpen, setNoteOpen] = useState(Boolean(resumed?.body.note))
  const formId = useId()
  const key = useRef(crypto.randomUUID())
  const completed = useRef(false)
  const [quoteAttempt, setQuoteAttempt] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({phone:'',postalCode:''})
  const errorTarget = useRef<HTMLParagraphElement>(null)
  useEffect(()=>{if(error)errorTarget.current?.focus()},[error])
  useEffect(()=>{if(resumed)setStorageLimited(!rememberSubmission(resumed))},[resumed])
  useEffect(() => { if(submission.current){setQuote(submission.current.quote);return} let active = true; const controller=new AbortController(); setQuote(null); setError(''); api<Quote>('/quote', {method:'POST',body:json({items}),signal:controller.signal}).then(value => {if(active) setQuote(value)}).catch(e => {if(active) setError(e.message)}); return () => {active = false;controller.abort()} }, [items, quoteAttempt])
  const ownerMatches=!submission.current||submission.current.ownerId===(user?.id??null)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (locked || (!quote&&!submission.current) || completed.current || !ownerMatches) return
    const errors=submission.current?{phone:'',postalCode:''}:{phone:phoneIssue(customer.phone),postalCode:postalIssue(customer.postalCode)}
    setFieldErrors(errors)
    if(errors.phone||errors.postalCode){document.getElementById(`${formId}-${errors.phone?'phone':'postal'}`)?.focus();return}
    const attempt=submission.current||{body:{items:items.map(item=>({...item})),customer:{...customer},note,idempotencyKey:key.current,expectedTotal:quote!.total},quote:quote!,ownerId:user?.id??null}
    const recovering=uncertain
    submission.current=attempt;setStorageLimited(!rememberSubmission(attempt))
    setBusy(true); setError('')
    try {
      const result = await api<Receipt>('/orders', {method:'POST',body:json(attempt.body)})
      setReceipt(result); completed.current = true;submission.current=null;rememberSubmission(null);setUncertain(false)
      try { const saved = JSON.parse(localStorage.getItem('autokala.receipts.v1') || '[]'); localStorage.setItem('autokala.receipts.v1',JSON.stringify([{id:result.order.id,token:result.receiptToken},...(Array.isArray(saved) ? saved : [])].slice(0,20))) } catch { /* Receipt remains visible when storage is unavailable. */ }
      onComplete(attempt.body.items)
    } catch(e) {
      setError((e as Error).message)
      if(!recovering&&e instanceof ApiError&&[400,401,403,404,409,413,422,429].includes(e.status)){
        submission.current=null;rememberSubmission(null);key.current=crypto.randomUUID();setUncertain(false)
        if(e.status===409)setQuote(null)
      }else setUncertain(true)
    } finally { setBusy(false) }
  }
  const field = (key: keyof Customer, value: string) => {setCustomer(current => ({...current,[key]:value}));if(key==='phone'||key==='postalCode')setFieldErrors(current=>({...current,[key]:current[key]?(key==='phone'?phoneIssue(value):postalIssue(value)):''}))}
  return <Modal className="checkout-dialog checkout-premium" surfaceRef={surface} title={receipt ? 'رسید سفارش' : 'تکمیل سفارش'} closeDisabled={locked} onClose={requestClose} footer={<div className="checkout-footer">
    {!receipt && <div className="checkout-footer-total"><span>{quote?'جمع سفارش':'مبلغ سفارش'}<small>تومان</small></span><strong>{quote ? <CartNumber value={quote.total}/> : 'در حال بررسی…'}</strong></div>}
    <div className="modal-actions">{receipt ? <button type="button" onClick={requestClose}>بستن رسید</button> : <><button type="button" disabled={locked} onClick={requestClose}>بازگشت</button><ActionButton form={formId} type="submit" pending={busy} disabled={closing||(!quote&&!submission.current)||!ownerMatches}>{uncertain?'دریافت نتیجه سفارش قبلی':'ثبت سفارش در انتظار پرداخت'}</ActionButton></>}</div>
    {!receipt && <p className="checkout-footer-note"><Icon name="shield" size={13}/> ثبت آزمایشی؛ بدون دریافت وجه</p>}
  </div>}>
    {receipt ? <div className="checkout-receipt"><div className="success-note" role="status" tabIndex={-1}><span className="success-symbol" aria-hidden="true"><Icon name="check"/></span>سفارش ثبت شد. پرداخت هنوز انجام نشده است.</div><OrderCard order={receipt.order} />{receipt.receiptToken && <div className="receipt-key"><strong>کلید محرمانه پیگیری</strong><code dir="ltr">{receipt.receiptToken}</code><p>شماره سفارش و کلید را نگه دارید. کلید را با دیگران به اشتراک نگذارید.</p><button type="button" onClick={() => {const data = new Blob([JSON.stringify(receipt,null,2)], {type:'application/json'}); const url=URL.createObjectURL(data); const a=document.createElement('a');a.href=url;a.download=`receipt-${receipt.order.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>دریافت رسید</button></div>}<p className="muted-note">درگاه پرداخت، روش ارسال و اطلاعات تماس هنوز تنظیم نشده‌اند. این نسخه برای بررسی مسیر سفارش است.</p></div> : <form id={formId} className="checkout-form" onSubmit={submit}>
      <ol className="checkout-steps" aria-label="مسیر سفارش"><li className="is-done"><span><Icon name="check" size={14}/></span>سبد خرید</li><li aria-current="step"><span>۲</span>مشخصات و ثبت</li><li><span>۳</span>رسید سفارش</li></ol>
      <p className="demo-note">ثبت آزمایشی سفارش؛ وجهی دریافت نمی‌شود. قیمت و موجودی نمونه‌اند.</p>
      {uncertain&&<p className="demo-note" role="status">نتیجه درخواست قبلی روشن نیست. برای دریافت رسید، همان درخواست دوباره بررسی می‌شود. اطلاعات تا روشن شدن نتیجه تغییر نمی‌کنند.{storageLimited&&' ذخیره موقت مرورگر در دسترس نیست؛ تا دریافت نتیجه، صفحه را تازه یا تب را بسته نکنید.'}{!ownerMatches&&(submission.current?.ownerId===null?' برای دریافت نتیجه، از حساب خارج شوید.':' برای دریافت نتیجه، با همان حساب زمان ثبت وارد شوید.')}</p>}
      <div className="checkout-layout"><div className="checkout-details">
      <section className="checkout-section" aria-labelledby={`${formId}-recipient`}>
      <div className="checkout-section-head"><span><Icon name="user"/></span><div><h3 id={`${formId}-recipient`}>اطلاعات گیرنده</h3><p>رسید و پیگیری سفارش با همین اطلاعات</p></div><b>۰۱</b></div>
      <div className="form-grid">
        <label>نام و نام خانوادگی<input disabled={locked||uncertain} autoComplete="name" required minLength={2} maxLength={120} value={customer.name} onChange={e=>field('name',e.target.value)} placeholder="نام کامل گیرنده سفارش" /></label>
        <label>موبایل گیرنده<input disabled={locked||uncertain} id={`${formId}-phone`} aria-label="موبایل گیرنده" type="tel" dir="ltr" autoComplete="tel" inputMode="tel" required maxLength={30} value={customer.phone} onChange={e=>field('phone',e.target.value)} onBlur={()=>setFieldErrors(current=>({...current,phone:phoneIssue(customer.phone)}))} aria-invalid={Boolean(fieldErrors.phone)||undefined} aria-describedby={fieldErrors.phone?`${formId}-phone-error`:undefined} placeholder="شماره موبایل با ۰۹" />{fieldErrors.phone&&<span className="form-error" id={`${formId}-phone-error`}>{fieldErrors.phone}</span>}</label>
        <label>ایمیل رسید<input disabled={locked||uncertain} autoComplete="email" type="email" required maxLength={254} value={customer.email} onChange={e=>field('email',e.target.value)} placeholder="name@example.com" dir="ltr" /></label>
        <label>کد پستی<input disabled={locked||uncertain} id={`${formId}-postal`} aria-label="کد پستی" dir="ltr" autoComplete="postal-code" inputMode="numeric" required maxLength={10} minLength={10} value={customer.postalCode} onChange={e=>field('postalCode',e.target.value)} onBlur={()=>setFieldErrors(current=>({...current,postalCode:postalIssue(customer.postalCode)}))} aria-invalid={Boolean(fieldErrors.postalCode)||undefined} aria-describedby={fieldErrors.postalCode?`${formId}-postal-error`:undefined} placeholder="کد پستی ۱۰ رقمی" />{fieldErrors.postalCode&&<span className="form-error" id={`${formId}-postal-error`}>{fieldErrors.postalCode}</span>}</label>
      </div>
      </section><section className="checkout-section" aria-labelledby={`${formId}-address`}>
      <div className="checkout-section-head"><span><Icon name="truck"/></span><div><h3 id={`${formId}-address`}>نشانی تحویل</h3><p>نشانی دقیق، برای هماهنگی بهتر</p></div><b>۰۲</b></div>
      <label className="description-field">نشانی کامل<textarea disabled={locked||uncertain} autoComplete="street-address" required minLength={10} maxLength={1000} value={customer.address} onChange={e=>field('address',e.target.value)} placeholder="استان، شهر، خیابان، کوچه، پلاک و واحد" /></label>
      <button type="button" className="checkout-note-toggle" aria-expanded={noteOpen} aria-controls={`${formId}-note`} onClick={()=>setNoteOpen(value=>!value)}><Icon name={noteOpen?'minus':'plus'} size={17}/> افزودن یادداشت سفارش <small>اختیاری</small></button>
      <div id={`${formId}-note`} hidden={!noteOpen} className="checkout-note-panel"><label className="description-field">یادداشت سفارش، اختیاری<textarea disabled={locked||uncertain} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="زمان مناسب هماهنگی یا نکته لازم درباره تحویل" /></label>
      </div></section></div>
      <aside className="checkout-summary" aria-label="خلاصه سفارش" aria-busy={!quote&&!error}>
        <div className="checkout-summary-head"><h3>سفارش شما</h3>{quote&&<span>{quote.items.reduce((sum,item)=>sum+item.quantity,0).toLocaleString('fa-IR')} عدد</span>}</div>
        {!quote&&!error&&<LoadingCar label="در حال دریافت مبلغ سفارش…"/>}
        {!quote&&error&&<p className="checkout-summary-wait">مبلغ سفارش هنوز تأیید نشده است.</p>}
        {quote&&<><ul className="checkout-products">{quote.items.map(item=>{const product=products.find(value=>value.id===item.productId);return <li key={item.productId}><div className="checkout-product-image" aria-hidden="true">{product?<ProductImage product={product}/>:<Icon name="box" size={25}/>}<b>{item.quantity.toLocaleString('fa-IR')}</b></div><div><h4>{item.name}</h4><span>{item.quantity.toLocaleString('fa-IR')} عدد · هر عدد {formatPrice(item.price)} تومان</span><strong>{formatPrice(item.lineTotal)} <small>تومان</small></strong></div></li>})}</ul>
        <dl className="checkout-totals"><div><dt>جمع کالاها</dt><dd>{formatPrice(quote.subtotal)} <small>تومان</small></dd></div><div><dt>ارسال نمونه</dt><dd>{quote.shipping===0?'بدون هزینه':`${formatPrice(quote.shipping)} تومان`}</dd></div><div className="checkout-grand-total"><dt>جمع سفارش</dt><dd><CartNumber value={quote.total}/><small>تومان</small></dd></div></dl></>}
        <p className="checkout-summary-note"><Icon name="shield" size={16}/> مبلغ و موجودی هنگام ثبت دوباره بررسی می‌شوند.</p>
      </aside></div>
      {error && <p ref={errorTarget} tabIndex={-1} className="form-error checkout-error" role="alert">{error}{!quote && <button type="button" onClick={()=>setQuoteAttempt(value=>value+1)}>دریافت دوباره مبلغ</button>}</p>}
      <p className="muted-note checkout-policy">سفارش بی‌پرداخت پس از ۲۴ ساعت لغو و رزرو کالا آزاد می‌شود. درگاه پرداخت و روش ارسال در انتظار تنظیم‌اند.</p>

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
  const [ordersError,setOrdersError] = useState('')
  const [ordersAttempt,setOrdersAttempt] = useState(0)
  const trackingRequest=useRef(0)
  const [tracked,setTracked] = useState<Order | null>(null)
  const [id,setId] = useState('')
  const [token,setToken] = useState('')
  const [savedReceipt,setSavedReceipt] = useState('')
  const [saved] = useState(savedReceipts)
  useEffect(() => {let active=true;const controller=new AbortController();setOrders([]);setOrdersError('');setHasMore(false);setOrdersLoading(Boolean(user));if(user)void api<{orders:Order[];pagination:{hasMore:boolean}}>('/orders?limit=50',{signal:controller.signal}).then(result=>{if(active){setOrders(result.orders);setHasMore(result.pagination.hasMore)}}).catch(e=>{if(active)setOrdersError(e.message)}).finally(()=>{if(active)setOrdersLoading(false)});return()=>{active=false;controller.abort()}}, [user,ordersAttempt])
  const moreOrders = async () => {if(busy)return;setBusy(true);setError('');try{const result=await api<{orders:Order[];pagination:{hasMore:boolean}}>(`/orders?limit=50&offset=${orders.length}`);setOrders(current=>[...current,...result.orders]);setHasMore(result.pagination.hasMore)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if(busy)return;setBusy(true);setError('')
    const data = new FormData(event.currentTarget)
    try {const result = await api<{user:User}>(`/auth/${mode}`,{method:'POST',body:json(Object.fromEntries(data))});onAuthenticated(result.user)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  const clearTracking = () => {trackingRequest.current++;setTracked(null);setError('')}
  const track = async (event:FormEvent) => {event.preventDefault();if(busy)return;const request=++trackingRequest.current;setBusy(true);setError('');setTracked(null);try{const result=await api<{order:Order}>(`/orders/${encodeURIComponent(id.trim())}`,{headers:{'X-Receipt-Token':token.trim()}});if(request===trackingRequest.current)setTracked(result.order)}catch(e){if(request===trackingRequest.current)setError((e as Error).message)}finally{setBusy(false)}}
  return <Modal title={user ? `حساب ${user.name}` : adminRequested ? 'ورود مدیر فروشگاه' : 'حساب و پیگیری سفارش'} onClose={onClose}>
    <div className="filter-pills dialog-tabs">{!user && <><button aria-pressed={mode==='login'} onClick={()=>{setMode('login');setError('')}} className={mode==='login'?'active':''}>ورود</button><button aria-pressed={mode==='register'} onClick={()=>{setMode('register');setError('')}} className={mode==='register'?'active':''}>ساخت حساب</button></>}<button aria-pressed={mode==='track'} onClick={()=>{setMode('track');setError('')}} className={mode==='track'?'active':''}>پیگیری سفارش</button></div>
    {!user && mode!=='track' && <form onSubmit={submit}><div className="form-grid">{mode==='register'&&<label>نام کامل<input required name="name" autoComplete="name" minLength={2} maxLength={120} placeholder="نام و نام خانوادگی" /></label>}<label>ایمیل<input required name="email" type="email" maxLength={254} dir="ltr" autoComplete="username" placeholder="name@example.com" /></label><label>رمز عبور<input required name="password" type="password" minLength={12} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} placeholder="حداقل ۱۲ نویسه" /></label></div><div className="modal-actions"><ActionButton pending={busy} pendingLabel="در حال بررسی…">{mode==='login'?'ورود به حساب':'ساخت حساب'}</ActionButton></div>{adminRequested&&<p className="muted-note">حساب مدیر با فرمان محلی ساخته می‌شود. حساب تازه، دسترسی مدیریت ندارد.</p>}</form>}
    {(mode==='track'||user)&&<><form onSubmit={track}><div className="form-grid"><label>شماره سفارش<input required value={id} maxLength={80} onChange={e=>{clearTracking();setSavedReceipt('');setId(e.target.value)}} dir="ltr" placeholder="شماره روی رسید" /></label><label>کلید پیگیری<input required={!user} value={token} maxLength={256} onChange={e=>{clearTracking();setSavedReceipt('');setToken(e.target.value)}} dir="ltr" placeholder="کلید محرمانه روی رسید" /></label></div><div className="modal-actions"><ActionButton pending={busy} done={Boolean(tracked)&&!error} pendingLabel="در حال دریافت…" doneLabel="سفارش پیدا شد">نمایش سفارش</ActionButton></div></form>{saved.length>0&&<label className="description-field">رسیدهای این دستگاه<Select label="رسیدهای این دستگاه" value={savedReceipt} placeholder="انتخاب رسید ذخیره‌شده" options={saved.map(r=>({value:r.id,label:r.id}))} onValueChange={value=>{clearTracking();setSavedReceipt(value);const receipt=saved.find(r=>r.id===value);if(receipt){setId(receipt.id);setToken(receipt.token||'')}}}/></label>}{tracked&&<OrderCard order={tracked} />}{user&&<><h3>سفارش‌های حساب</h3>{ordersLoading?<LoadingCar label="در حال دریافت سفارش‌ها…"/>:ordersError?<div className="form-error" role="alert"><p>{ordersError}</p><button type="button" onClick={()=>setOrdersAttempt(value=>value+1)}>دریافت دوباره سفارش‌ها</button></div>:orders.length?orders.map(order=><OrderCard order={order} key={order.id}/>):<p className="muted-note">هنوز سفارشی با این حساب ثبت نشده است.</p>}</>}</>}
    {hasMore&&<div className="modal-actions"><ActionButton onClick={moreOrders} pending={busy} pendingLabel="در حال دریافت…">سفارش‌های بیشتر</ActionButton></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}{user&&<div className="modal-actions"><button onClick={()=>{onLogout();onClose()}}>خروج از حساب</button></div>}
  </Modal>
}
