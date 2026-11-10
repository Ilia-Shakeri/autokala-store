import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { api, json } from './api'
import { Modal } from './Modal'
import { Select } from './Select'
import { ActionButton } from './ActionButton'
import { LoadingCar } from './LoadingCar'
import { Icon } from './ui'
import { AccountOrderCard } from './AccountOrderCard'
import { useDialogMotion } from './dialog-motion'
import type { Order, User } from './types'
import './account.css'

type SavedReceipt = {id:string;token?:string}
function savedReceipts(): SavedReceipt[] {
  try {
    const value:unknown=JSON.parse(localStorage.getItem('autokala.receipts.v1')||'[]')
    if(!Array.isArray(value))return []
    const seen=new Set<string>()
    return value.filter((receipt):receipt is SavedReceipt=>{
      if(!receipt||typeof receipt!=='object'||typeof receipt.id!=='string'||!receipt.id.trim()||receipt.id.length>80||seen.has(receipt.id))return false
      if(receipt.token!==undefined&&(typeof receipt.token!=='string'||receipt.token.length>256))return false
      seen.add(receipt.id);return true
    }).slice(0,20)
  } catch {return []}
}
type Mode='login'|'register'|'track'|'orders'
type Busy='auth'|'track'|'more'|'logout'|null
type Props={user:User|null;adminRequested:boolean;onClose:()=>void;onAuthenticated:(user:User)=>void;onLogout:()=>void|Promise<void>}

export function AccountDialog({user,adminRequested,onClose,onAuthenticated,onLogout}:Props) {
  const [mode,setMode]=useState<Mode>(user?'orders':'login')
  const [busy,setBusy]=useState<Busy>(null)
  const [error,setError]=useState('')
  const [orders,setOrders]=useState<Order[]>([])
  const [ordersLoading,setOrdersLoading]=useState(Boolean(user))
  const [hasMore,setHasMore]=useState(false)
  const [ordersError,setOrdersError]=useState('')
  const [ordersAttempt,setOrdersAttempt]=useState(0)
  const [tracked,setTracked]=useState<Order|null>(null)
  const [id,setId]=useState('')
  const [token,setToken]=useState('')
  const [savedReceipt,setSavedReceipt]=useState('')
  const [saved]=useState(savedReceipts)
  const [showPassword,setShowPassword]=useState(false)
  const tracking=useRef({version:0,controller:null as AbortController|null})
  const historyVersion=useRef(0)
  const historyOffset=useRef(0)
  const mounted=useRef(true)
  const panel=useRef<HTMLDivElement>(null)
  const errorTarget=useRef<HTMLDivElement>(null)
  const trackedTarget=useRef<HTMLElement>(null)
  const formId=useId()
  const previousUser=useRef(user?.id)
  const {closing,requestClose}=useDialogMotion(panel,Boolean(busy),onClose)
  const locked=Boolean(busy)||closing
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;tracking.current.controller?.abort();historyVersion.current++}},[])
  useEffect(()=>{if(error)errorTarget.current?.focus()},[error])
  useLayoutEffect(()=>{if(trackedTarget.current){trackedTarget.current.focus({preventScroll:true});trackedTarget.current.scrollIntoView({block:'start',behavior:'instant'})}},[tracked])
  useLayoutEffect(()=>{
    if(!user){previousUser.current=undefined;return}
    if(mode==='orders'&&previousUser.current!==user.id){panel.current?.querySelector<HTMLElement>('.account-view-head h3')?.focus();previousUser.current=user.id}
  },[mode,user?.id])
  useEffect(()=>{
    setMode(user?'orders':'login');setBusy(null);setError('');setShowPassword(false);setTracked(null);setToken('');setId('');setSavedReceipt('')
    tracking.current.version++;tracking.current.controller?.abort()
  },[user?.id])
  useEffect(()=>{
    const version=++historyVersion.current
    const controller=new AbortController()
    historyOffset.current=0;setOrders([]);setOrdersError('');setHasMore(false);setOrdersLoading(Boolean(user))
    if(user)void api<{orders:Order[];pagination:{hasMore:boolean}}>('/orders?limit=50',{signal:controller.signal})
      .then(result=>{if(version===historyVersion.current){historyOffset.current=result.orders.length;setOrders(result.orders);setHasMore(result.pagination.hasMore)}})
      .catch(e=>{if(version===historyVersion.current&&!controller.signal.aborted)setOrdersError(e.message)})
      .finally(()=>{if(version===historyVersion.current)setOrdersLoading(false)})
    return()=>{controller.abort();historyVersion.current++}
  },[user?.id,ordersAttempt])
  const clearTracking=()=>{
    tracking.current.version++;tracking.current.controller?.abort();setTracked(null);setError('')
    setBusy(current=>current==='track'?null:current)
  }
  const switchMode=(next:Mode)=>{if(locked)return;clearTracking();setShowPassword(false);setMode(next)}
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(locked)return
    setBusy('auth');setError('')
    const data=new FormData(event.currentTarget)
    try {const result=await api<{user:User}>(`/auth/${mode}`,{method:'POST',body:json(Object.fromEntries(data))});if(mounted.current)onAuthenticated(result.user)}
    catch(e){if(mounted.current)setError((e as Error).message)}finally{if(mounted.current)setBusy(null)}
  }
  const track=async(event:FormEvent)=>{
    event.preventDefault();if(locked)return
    const version=++tracking.current.version
    tracking.current.controller?.abort();const controller=new AbortController();tracking.current.controller=controller
    setBusy('track');setError('');setTracked(null)
    try {const result=await api<{order:Order}>(`/orders/${encodeURIComponent(id.trim())}`,{headers:{'X-Receipt-Token':token.trim()},signal:controller.signal});if(version===tracking.current.version&&mounted.current)setTracked(result.order)}
    catch(e){if(version===tracking.current.version&&mounted.current&&!controller.signal.aborted)setError((e as Error).message)}
    finally{if(version===tracking.current.version&&mounted.current)setBusy(null)}
  }
  const moreOrders=async()=>{
    if(locked)return;setBusy('more');setError('');const version=historyVersion.current
    try {const result=await api<{orders:Order[];pagination:{hasMore:boolean}}>(`/orders?limit=50&offset=${historyOffset.current}`);if(version===historyVersion.current){historyOffset.current+=result.orders.length;setOrders(current=>[...current,...result.orders.filter(next=>!current.some(old=>old.id===next.id))]);setHasMore(result.pagination.hasMore)}}
    catch(e){if(version===historyVersion.current)setError((e as Error).message)}finally{if(version===historyVersion.current&&mounted.current)setBusy(null)}
  }
  const logout=async()=>{if(locked)return;setBusy('logout');setError('');try{await onLogout()}catch(e){if(mounted.current)setError((e as Error).message)}finally{if(mounted.current)setBusy(null)}}
  const authMode=!user&&(mode==='login'||mode==='register')
  const title=user?'حساب کاربری':adminRequested?'ورود مدیر فروشگاه':'حساب و پیگیری سفارش'
  return <Modal className="account-dialog" surfaceRef={panel} title={title} closeDisabled={locked} onClose={requestClose} footer={<div className="account-footer"><span><Icon name="shield" size={15}/> اطلاعات پیگیری را محرمانه نگه دارید.</span>{user?<ActionButton type="button" pending={busy==='logout'} pendingLabel="در حال خروج…" disabled={locked} onClick={logout}>خروج از حساب</ActionButton>:<button type="button" disabled={locked} onClick={requestClose}>بازگشت به فروشگاه<Icon name="arrow" size={16}/></button>}</div>}>
    <div className="account-body">
      <div className="account-layout">
        <aside className="account-intro" aria-label={user?'مشخصات حساب':'راهنمای حساب'}>
          <span className="account-mark"><Icon name={user?'user':'bag'} size={30}/></span>
          <span className="account-eyebrow">اتوکالا · همراه سفارش‌های شما</span>
          <h3>{user?user.name:<>خریدت اینجاست،<br/>{' '}پیگیری‌اش هم همین‌جا.</>}</h3>
          {user?<bdi className="account-email">{user.email}</bdi>:<p>با حساب وارد شو؛ یا با شماره و کلید رسید، سفارشت را پیدا کن.</p>}
          <ul><li><Icon name="orders" size={18}/><span>جزئیات هر سفارش<small>کالاها، مبلغ و وضعیت ثبت‌شده</small></span></li><li><Icon name="shield" size={18}/><span>پیگیری با کلید اختصاصی<small>کلید روی رسید، فقط برای شما</small></span></li></ul>
          <p className="account-demo">نسخه آزمایشی فروشگاه؛ پرداخت آنلاین هنوز فعال نیست.</p>
        </aside>
        <div className="account-main">
          <nav className="account-nav" aria-label="بخش‌های حساب">{(user?(['orders','track'] as const):(['login','register','track'] as const)).map(value=><button key={value} type="button" aria-pressed={mode===value} disabled={locked} onClick={()=>switchMode(value)}>{value==='orders'?'سفارش‌های من':value==='login'?'ورود':value==='register'?'ساخت حساب':'پیگیری سفارش'}</button>)}</nav>
          <div className="account-view" key={`${mode}-${user?.id??'guest'}`}>
            <header className="account-view-head"><span className="account-eyebrow">{authMode?'حساب شما':mode==='orders'?'خریدهای ثبت‌شده':'پیگیری با رسید'}</span><h3 tabIndex={-1}>{authMode?(mode==='login'?'خوش برگشتی.':'حسابت را بساز.'):mode==='orders'?'سفارش‌های حساب':'از سفارشت خبر بگیر.'}</h3><p>{authMode?(mode==='login'?'ایمیل و رمز حساب را وارد کن.':'نام، ایمیل و یک رمز با حداقل ۱۲ نویسه.'):mode==='orders'?'وضعیت هر سفارش و جزئیات کالاها را ببین.':user?'برای سفارش‌های همین حساب، شماره سفارش کافی است.':'شماره سفارش و کلید محرمانه را از روی رسید وارد کن.'}</p></header>
            {authMode&&<form id={formId} onSubmit={submit}>
              <div className="form-grid">{mode==='register'&&<label>نام کامل<input disabled={locked} required name="name" autoComplete="name" minLength={2} maxLength={120} placeholder="نام و نام خانوادگی"/></label>}
              <label>ایمیل<input disabled={locked} required name="email" type="email" maxLength={254} dir="ltr" autoComplete="username" placeholder="name@example.com"/></label>
              <label htmlFor={`${formId}-password`}>رمز عبور</label><div className="account-password"><input id={`${formId}-password`} disabled={locked} required name="password" type={showPassword?'text':'password'} dir="ltr" minLength={12} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} placeholder="حداقل ۱۲ نویسه"/><button type="button" disabled={locked} aria-controls={`${formId}-password`} aria-pressed={showPassword} aria-label={showPassword?'پنهان کردن رمز عبور':'نمایش رمز عبور'} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'پنهان':'نمایش'}</button></div>
              </div><div className="modal-actions"><ActionButton pending={busy==='auth'} disabled={closing} pendingLabel="در حال بررسی…">{mode==='login'?'ورود به حساب':'ساخت حساب'}</ActionButton></div>
              {adminRequested&&<p className="muted-note">حساب مدیر با فرمان محلی ساخته می‌شود. حساب تازه، دسترسی مدیریت ندارد.</p>}
            </form>}
            {mode==='track'&&<>
              {saved.length>0&&<label className="account-saved">رسیدهای این دستگاه<Select label="رسیدهای این دستگاه" disabled={closing} value={savedReceipt} placeholder="انتخاب رسید ذخیره‌شده" options={saved.map(r=>({value:r.id,label:r.id}))} onValueChange={value=>{clearTracking();setSavedReceipt(value);const receipt=saved.find(r=>r.id===value);if(receipt){setId(receipt.id);setToken(receipt.token||'')}}}/><small>رسیدهای ذخیره‌شده در همین مرورگر؛ ممکن است متعلق به حساب دیگری باشند.</small></label>}
              <form onSubmit={track}><div className="form-grid"><label>شماره سفارش<input disabled={closing} required value={id} maxLength={80} onChange={e=>{clearTracking();setSavedReceipt('');setId(e.target.value)}} dir="ltr" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="AK-…"/></label><label>کلید پیگیری<input disabled={closing} required={!user} value={token} maxLength={256} onChange={e=>{clearTracking();setSavedReceipt('');setToken(e.target.value)}} dir="ltr" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={user?'برای سفارش مهمان، کلید رسید':'کلید محرمانه روی رسید'}/></label></div>
                <div className="modal-actions"><ActionButton pending={busy==='track'} disabled={closing} done={Boolean(tracked)&&!error} pendingLabel="در حال دریافت…" doneLabel="سفارش پیدا شد">نمایش سفارش</ActionButton>{busy==='track'&&<button type="button" className="account-cancel" onClick={clearTracking}>لغو دریافت</button>}</div>
              </form>
              {tracked?<div className="account-tracked"><AccountOrderCard ref={trackedTarget} order={tracked} expanded/></div>:!busy&&!error&&<div className="account-track-hint"><Icon name="search" size={24}/><p>رسیدت را آماده کن.<small>وضعیت سفارش پس از بررسی اینجا نمایش داده می‌شود.</small></p></div>}
            </>}
            {user&&mode==='orders'&&<section aria-label="سفارش‌های حساب" aria-busy={ordersLoading}>
              {ordersLoading?<LoadingCar label="در حال دریافت سفارش‌ها…"/>:ordersError?<div className="account-error" role="alert"><p>{ordersError}</p><button type="button" onClick={()=>setOrdersAttempt(value=>value+1)}>دریافت دوباره سفارش‌ها</button></div>:orders.length?<div className="account-orders">{orders.map(order=><AccountOrderCard key={order.id} order={order}/>)}</div>:<div className="account-empty"><span><Icon name="bag" size={32}/></span><h4>اولین انتخابت منتظرته.</h4><p>هنوز سفارشی با این حساب ثبت نشده است.</p><button type="button" onClick={requestClose}>دیدن کالاهای فروشگاه<Icon name="arrow" size={16}/></button></div>}
              {hasMore&&<div className="modal-actions"><ActionButton onClick={moreOrders} pending={busy==='more'} disabled={closing} pendingLabel="در حال دریافت…">سفارش‌های بیشتر</ActionButton></div>}
            </section>}
          </div>
          {error&&<div ref={errorTarget} tabIndex={-1} className="account-error" role="alert">{error}</div>}
        </div>
      </div>
    </div>
  </Modal>
}
