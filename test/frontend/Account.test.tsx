import {beforeEach,it,expect,vi} from 'vitest'
import {render,screen,act,fireEvent,waitFor} from '@testing-library/react'
import {AccountDialog} from '../../src/CommerceDialogs'
import {api} from '../../src/api'
vi.mock('../../src/api',async original=>({...await original<typeof import('../../src/api')>(),api:vi.fn()}))
beforeEach(()=>{vi.mocked(api).mockReset()})
it('keeps a car status while account orders load instead of claiming there are no orders',async()=>{
  let finish!:(value:unknown)=>void
  vi.mocked(api).mockImplementation(()=>new Promise(resolve=>{finish=resolve}) as never)
  render(<AccountDialog user={{id:5,name:'خریدار نمونه',email:'test@example.test',role:'customer'}} adminRequested={false} onClose={()=>{}} onAuthenticated={()=>{}} onLogout={()=>{}}/>)
  expect(screen.getByRole('status').textContent).toContain('در حال دریافت سفارش‌ها')
  expect(screen.queryByText('هنوز سفارشی با این حساب ثبت نشده است.')).toBeNull()
  await act(async()=>finish({orders:[],pagination:{hasMore:false}}))
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText('هنوز سفارشی با این حساب ثبت نشده است.')).toBeTruthy()
})
it('shows a retry after an order history error without a false empty claim',async()=>{
  vi.mocked(api).mockRejectedValueOnce(new Error('ارتباط قطع شد')).mockResolvedValue({orders:[],pagination:{hasMore:false}} as never)
  render(<AccountDialog user={{id:5,name:'خریدار نمونه',email:'test@example.test',role:'customer'}} adminRequested={false} onClose={()=>{}} onAuthenticated={()=>{}} onLogout={()=>{}}/>)
  await screen.findByText('ارتباط قطع شد')
  expect(screen.queryByText('هنوز سفارشی با این حساب ثبت نشده است.')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'دریافت دوباره سفارش‌ها'}))
  await screen.findByText('هنوز سفارشی با این حساب ثبت نشده است.')
})
it('clears an old receipt when the tracking number changes',async()=>{
  const order={id:'AK-TEST',status:'pending_payment',createdAt:new Date().toISOString(),items:[],shipping:0,total:100}
  vi.mocked(api).mockResolvedValue({order} as never)
  render(<AccountDialog user={null} adminRequested={false} onClose={()=>{}} onAuthenticated={()=>{}} onLogout={()=>{}}/>)
  fireEvent.click(screen.getByRole('button',{name:'پیگیری سفارش'}))
  fireEvent.change(screen.getByLabelText('شماره سفارش',{exact:true}),{target:{value:order.id}})
  fireEvent.submit(screen.getByLabelText('شماره سفارش',{exact:true}).closest('form')!)
  await screen.findByRole('button',{name:'سفارش پیدا شد'})
  fireEvent.change(screen.getByLabelText('شماره سفارش',{exact:true}),{target:{value:'AK-NEXT'}})
  expect(screen.queryByText(order.id)).toBeNull()
  expect(screen.queryByRole('button',{name:'سفارش پیدا شد'})).toBeNull()
})

const guestProps={user:null,adminRequested:false,onClose:()=>{},onAuthenticated:()=>{},onLogout:()=>{}}
const sampleUser={id:5,name:'خریدار نمونه',email:'test@example.test',role:'customer' as const}
const sampleOrder={id:'AK-TEST-ORDER',status:'pending_payment',createdAt:new Date().toISOString(),items:[{productId:1,name:'فیلتر نمونه',price:100,quantity:2,lineTotal:200}],subtotal:200,shipping:10,total:210,customer:{name:'نمونه',email:'test@example.test',phone:'09123456789',address:'نشانی ساختگی برای تست',postalCode:'1234567890'}}
it('keeps password visibility local to a form and never includes its toggle in credentials',async()=>{
  const authenticated=vi.fn();vi.mocked(api).mockResolvedValue({user:sampleUser} as never)
  render(<AccountDialog {...guestProps} onAuthenticated={authenticated}/>)
  fireEvent.change(screen.getByLabelText('ایمیل',{exact:true}),{target:{value:sampleUser.email}})
  const password=screen.getByLabelText('رمز عبور',{exact:true}) as HTMLInputElement
  fireEvent.change(password,{target:{value:'synthetic-password-123'}})
  fireEvent.click(screen.getByRole('button',{name:'نمایش رمز عبور'}));expect(password.type).toBe('text')
  fireEvent.submit(password.closest('form')!)
  await waitFor(()=>expect(authenticated).toHaveBeenCalledWith(sampleUser))
  expect(JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string)).toEqual({email:sampleUser.email,password:'synthetic-password-123'})
  fireEvent.click(screen.getByRole('button',{name:'ساخت حساب',exact:true}))
  expect((screen.getByLabelText('رمز عبور',{exact:true}) as HTMLInputElement).type).toBe('password')
  expect((screen.getByLabelText('رمز عبور',{exact:true}) as HTMLInputElement).value).toBe('')
})
it('locks auth mode and close during a real pending login and focuses a returned error',async()=>{
  let reject!:(error:Error)=>void;vi.mocked(api).mockImplementation(()=>new Promise((_,failure)=>{reject=failure}))
  const close=vi.fn();render(<AccountDialog {...guestProps} onClose={close}/>)
  const form=screen.getByLabelText('رمز عبور').closest('form')!
  fireEvent.submit(form);fireEvent.submit(form)
  expect(vi.mocked(api)).toHaveBeenCalledOnce()
  expect((screen.getByRole('button',{name:'ساخت حساب',exact:true}) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'بستن',exact:true}));expect(close).not.toHaveBeenCalled()
  await act(async()=>reject(new Error('رمز درست نیست')))
  expect(document.activeElement).toBe(screen.getByRole('alert'))
})
it('aborts changed tracking and ignores its late result while a newer result remains current',async()=>{
  const scroll=vi.spyOn(Element.prototype,'scrollIntoView')
  let finishOld!:(value:unknown)=>void,finishNew!:(value:unknown)=>void
  vi.mocked(api).mockImplementation(path=>new Promise(resolve=>{if(path==='/orders/AK-OLD')finishOld=resolve;else finishNew=resolve}))
  render(<AccountDialog {...guestProps}/>)
  fireEvent.click(screen.getByRole('button',{name:'پیگیری سفارش'}))
  const number=screen.getByLabelText('شماره سفارش',{exact:true})
  fireEvent.change(number,{target:{value:'AK-OLD'}});fireEvent.submit(number.closest('form')!)
  const signal=vi.mocked(api).mock.calls[0][1]!.signal!
  fireEvent.change(number,{target:{value:'AK-NEW'}});expect(signal.aborted).toBe(true)
  fireEvent.submit(number.closest('form')!)
  await act(async()=>finishOld({order:{...sampleOrder,id:'AK-OLD'}}))
  expect(screen.queryByRole('article',{name:'سفارش AK-OLD'})).toBeNull()
  expect(screen.getByRole('button',{name:'در حال دریافت…'})).toBeTruthy()
  await act(async()=>finishNew({order:{...sampleOrder,id:'AK-NEW'}}))
  expect(document.activeElement).toBe(screen.getByRole('article',{name:'سفارش AK-NEW'}))
  expect(scroll).toHaveBeenCalledWith({block:'start',behavior:'instant'})
  expect(screen.getByText('در انتظار پرداخت')).toBeTruthy()
})
it('loads a saved receipt without putting its secret in a URL and permits cancelling a lookup',async()=>{
  localStorage.setItem('autokala.receipts.v1',JSON.stringify([{id:'AK-SAVED',token:'test-key-123'}]))
  let signal:AbortSignal|undefined
  vi.mocked(api).mockImplementation(async(_path,options)=>{signal=options?.signal as AbortSignal;return new Promise(()=>{})})
  render(<AccountDialog {...guestProps}/>)
  fireEvent.click(screen.getByRole('button',{name:'پیگیری سفارش'}))
  fireEvent.change(screen.getByLabelText('شماره سفارش',{exact:true}),{target:{value:'AK-SAVED'}})
  fireEvent.change(screen.getByLabelText('کلید پیگیری',{exact:true}),{target:{value:'test-key-123'}})
  fireEvent.submit(screen.getByLabelText('شماره سفارش',{exact:true}).closest('form')!)
  expect(vi.mocked(api).mock.calls[0][0]).toBe('/orders/AK-SAVED')
  expect(vi.mocked(api).mock.calls[0][1]!.headers).toEqual({'X-Receipt-Token':'test-key-123'})
  fireEvent.click(screen.getByRole('button',{name:'لغو دریافت'}));expect(signal!.aborted).toBe(true)
  expect((screen.getByRole('button',{name:'نمایش سفارش'}) as HTMLButtonElement).disabled).toBe(false)
})
it('shows signed-in history separately from guest tracking and exposes native order details',async()=>{
  vi.mocked(api).mockResolvedValue({orders:[sampleOrder],pagination:{hasMore:false}} as never)
  render(<AccountDialog {...guestProps} user={sampleUser}/>)
  const card=await screen.findByRole('article',{name:`سفارش ${sampleOrder.id}`})
  expect(card.querySelector('details')!.open).toBe(false)
  fireEvent.click(card.querySelector('summary')!)
  expect(card.querySelector('details')!.open).toBe(true)
  expect(screen.queryByLabelText('شماره سفارش',{exact:true})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'پیگیری سفارش'}))
  expect((screen.getByLabelText('کلید پیگیری',{exact:true}) as HTMLInputElement).required).toBe(false)
})
it('keeps history visible after failed paging and retries from the same consumed offset',async()=>{
  let pages=0
  vi.mocked(api).mockImplementation(async path=>{
    if(path==='/orders?limit=50')return {orders:[sampleOrder],pagination:{hasMore:true}} as never
    if(++pages===1)throw new Error('صفحه نرسید')
    return {orders:[sampleOrder,{...sampleOrder,id:'AK-NEXT'}],pagination:{hasMore:false}} as never
  })
  render(<AccountDialog {...guestProps} user={sampleUser}/>)
  await screen.findByRole('article',{name:`سفارش ${sampleOrder.id}`})
  fireEvent.click(screen.getByRole('button',{name:'سفارش‌های بیشتر'}));await screen.findByRole('alert')
  expect(screen.getByRole('article',{name:`سفارش ${sampleOrder.id}`})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'سفارش‌های بیشتر'}));await screen.findByRole('article',{name:'سفارش AK-NEXT'})
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(vi.mocked(api).mock.calls.slice(1).map(([path])=>path)).toEqual(['/orders?limit=50&offset=1','/orders?limit=50&offset=1'])
})
it('does not close a session when logout fails',async()=>{
  vi.mocked(api).mockResolvedValue({orders:[],pagination:{hasMore:false}} as never)
  const close=vi.fn(),logout=vi.fn().mockRejectedValue(new Error('خروج ناموفق'))
  render(<AccountDialog {...guestProps} user={sampleUser} onClose={close} onLogout={logout}/>)
  await screen.findByText('هنوز سفارشی با این حساب ثبت نشده است.')
  fireEvent.click(screen.getByRole('button',{name:'خروج از حساب'}));await screen.findByRole('alert')
  expect(close).not.toHaveBeenCalled();expect(screen.getByText(sampleUser.email)).toBeTruthy()
})

it('moves a successful sign-in into the focused account overview without closing the dialog',async()=>{
  vi.mocked(api).mockResolvedValue({orders:[],pagination:{hasMore:false}} as never)
  const close=vi.fn();const view=render(<AccountDialog {...guestProps} onClose={close}/>)
  view.rerender(<AccountDialog {...guestProps} user={sampleUser} onClose={close}/>)
  await screen.findByText('هنوز سفارشی با این حساب ثبت نشده است.')
  expect(document.activeElement).toBe(screen.getByRole('heading',{name:'سفارش‌های حساب',exact:true}))
  expect(close).not.toHaveBeenCalled()
})

it('does not leak a previous users late history page into a new account',async()=>{
  let finish!:(value:unknown)=>void
  let loads=0
  vi.mocked(api).mockImplementation(async path=>{
    if(path==='/orders?limit=50')return ++loads===1?{orders:[sampleOrder],pagination:{hasMore:true}}:{orders:[],pagination:{hasMore:false}}
    return new Promise(resolve=>{finish=resolve})
  })
  const view=render(<AccountDialog {...guestProps} user={sampleUser}/>)
  await screen.findByRole('article',{name:`سفارش ${sampleOrder.id}`})
  fireEvent.click(screen.getByRole('button',{name:'سفارش‌های بیشتر'}))
  view.rerender(<AccountDialog {...guestProps} user={{...sampleUser,id:6,name:'حساب تازه'}}/>)
  await screen.findByText('هنوز سفارشی با این حساب ثبت نشده است.')
  await act(async()=>finish({orders:[{...sampleOrder,id:'AK-PRIVATE-OLD'}],pagination:{hasMore:false}}))
  expect(screen.queryByRole('article')).toBeNull()
})
