import { useState, type FormEvent } from 'react'
import { api, json } from './api'
import type { User } from './types'
import { Logo, Icon } from './ui'

export default function AdminLogin({publicOrigin,onAuthenticated}:{publicOrigin:string;onAuthenticated:(user:User)=>void}) {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy)return
    setBusy(true);setError('')
    const data=new FormData(event.currentTarget)
    try {const result=await api<{user:User}>('/auth/login',{method:'POST',body:json(Object.fromEntries(data))});if(result.user.role!=='admin')throw new Error('این حساب دسترسی مدیریت ندارد.');onAuthenticated(result.user)}
    catch(failure){setError((failure as Error).message)}finally{setBusy(false)}
  }
  return <main className="admin-gate" dir="rtl"><div className="admin-login-card"><Logo light/><span className="admin-login-kicker"><Icon name="shield" size={17}/>ورود مخصوص مدیر فروشگاه</span><h1>مدیریت اتوکالا</h1><p>این نشانی فقط برای مدیر است. حساب مشتری در این بخش پذیرفته نمی‌شود.</p><form onSubmit={submit}><fieldset disabled={busy}><label>ایمیل مدیر<input required type="email" name="email" dir="ltr" autoComplete="username" placeholder="ایمیل حساب مدیر"/></label><label>رمز عبور<input required type="password" name="password" minLength={12} maxLength={128} autoComplete="current-password" placeholder="رمز حساب مدیر"/></label><button className="admin-login-submit" disabled={busy}>{busy?'در حال بررسی…':'ورود به مدیریت'}<Icon name="arrow" size={17}/></button></fieldset>{error&&<p className="admin-login-error" role="alert">{error}</p>}</form><a href={publicOrigin}>بازگشت به فروشگاه</a><small>حساب مدیر از روی میزبان ساخته می‌شود؛ ثبت‌نام عمومی ندارد.</small></div></main>
}
