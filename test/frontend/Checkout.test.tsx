import { beforeEach,it,expect,vi } from 'vitest'
import { render,screen,fireEvent,waitFor,within } from '@testing-library/react'
import { CheckoutDialog } from '../../src/CommerceDialogs'
import { api,ApiError } from '../../src/api'

vi.mock('../../src/api',async importOriginal=>({...await importOriginal<typeof import('../../src/api')>(),api:vi.fn()}))
const mocked=vi.mocked(api)
const items=[{productId:1,quantity:2}]
const quote={subtotal:200,shipping:10,total:210,items:[{productId:1,name:'کالای نمونه',price:100,quantity:2,lineTotal:200}]}
const order={id:'AK-ABCDEF0123456789',customer:{name:'کاربر نمونه',email:'buyer@example.test',phone:'09123456789',address:'نشانی ساختگی برای آزمون، پلاک ۱۲',postalCode:'1234567890'},items:quote.items,subtotal:200,shipping:10,total:210,status:'pending_payment',createdAt:new Date().toISOString()}
beforeEach(()=>{mocked.mockReset()})
async function fill(){await waitFor(()=>expect((screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement).disabled).toBe(false));for(const [name,value] of [['نام و نام خانوادگی','کاربر نمونه'],['موبایل گیرنده','09123456789'],['ایمیل رسید','buyer@example.test'],['کد پستی','1234567890'],['نشانی کامل','نشانی ساختگی برای آزمون، پلاک ۱۲']])fireEvent.change(screen.getByLabelText(name,{exact:true}),{target:{value}})}
function submit(){fireEvent.submit((screen.getByRole('button',{name:/ثبت سفارش در انتظار پرداخت|دریافت نتیجه سفارش قبلی/}) as HTMLButtonElement).form!)}

it('keeps submit linked to the form and blocks duplicate submission while the real request is pending',async()=>{
  let finish:(value:unknown)=>void=()=>{}
  mocked.mockImplementation(async path=>{if(path==='/quote')return quote;if(path==='/orders')return new Promise(resolve=>{finish=resolve});return {} as never})
  render(<CheckoutDialog items={items} user={null} onClose={()=>{}} onComplete={()=>{}}/>);await fill()
  const button=screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement
  expect(button.closest('form')).toBeNull();expect(button.form).toBeTruthy()
  const form=button.form!
  fireEvent.submit(form);fireEvent.submit(form)
  expect((screen.getByRole('button',{name:'در حال ثبت…'}) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')).toBeNull()
  expect(mocked.mock.calls.filter(([path])=>path==='/orders')).toHaveLength(1)
  finish({order,receiptToken:'b'.repeat(43)})
  await screen.findByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')
})

it('invalidates a stale total after conflict and requires a fresh quote before retry',async()=>{
  let quotes=0,orders=0
  mocked.mockImplementation(async path=>{if(path==='/quote')return ++quotes===1?quote:{...quote,total:230,shipping:30};if(path==='/orders'){orders++;throw new ApiError('قیمت یا هزینه ارسال تغییر کرده',409)}return {} as never})
  render(<CheckoutDialog items={items} user={null} onClose={()=>{}} onComplete={()=>{}}/>);await fill();submit();await screen.findByRole('alert')
  expect((screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement).disabled).toBe(true)
  expect(orders).toBe(1)
  const first=JSON.parse(mocked.mock.calls.find(([path])=>path==='/orders')![1]!.body as string);expect(first.expectedTotal).toBe(210)
  fireEvent.click(screen.getByRole('button',{name:'دریافت دوباره مبلغ'}));await waitFor(()=>expect((screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement).disabled).toBe(false));expect(quotes).toBe(2)
})
it('reuses the idempotency key after a network/server failure and persists a successful receipt once',async()=>{
  let attempts=0
  mocked.mockImplementation(async path=>{if(path==='/quote')return quote;if(path==='/orders'){if(++attempts===1)throw new ApiError('دوباره تلاش کنید',503);return {order,receiptToken:'a'.repeat(43)}}return {} as never})
  const completed=vi.fn();render(<CheckoutDialog items={items} user={null} onClose={()=>{}} onComplete={completed}/>);await fill();submit();await screen.findByRole('alert');submit();await screen.findByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')
  const bodies=mocked.mock.calls.filter(([path])=>path==='/orders').map(([,options])=>JSON.parse(options!.body as string));expect(bodies).toHaveLength(2);expect(bodies[0].idempotencyKey).toBe(bodies[1].idempotencyKey);expect(completed).toHaveBeenCalledOnce();expect(JSON.parse(localStorage.getItem('autokala.receipts.v1')!)[0].id).toBe(order.id)
})
it('disables submit while changed basket items wait for a new quote',async()=>{
  let nextQuote!:(value:unknown)=>void
  let calls=0
  mocked.mockImplementation(async path=>path==='/quote'?(++calls===1?quote:new Promise(resolve=>{nextQuote=resolve})):{} as never)
  const props={user:null,onClose:()=>{},onComplete:()=>{}}
  const {rerender}=render(<CheckoutDialog {...props} items={items}/>);await fill()
  rerender(<CheckoutDialog {...props} items={[{productId:1,quantity:3}]}/>)
  expect((screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement).disabled).toBe(true)
  await waitFor(()=>expect(calls).toBe(2))
  nextQuote({...quote,total:310,subtotal:300})
  await waitFor(()=>expect((screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement).disabled).toBe(false))
})
it('shows field errors before sending malformed phone or postal details',async()=>{
  mocked.mockResolvedValue(quote as never)
  render(<CheckoutDialog items={items} user={null} onClose={()=>{}} onComplete={()=>{}}/>);await fill()
  fireEvent.change(screen.getByLabelText('موبایل گیرنده',{exact:true}),{target:{value:'123'}})
  fireEvent.blur(screen.getByLabelText('موبایل گیرنده',{exact:true}))
  fireEvent.change(screen.getByLabelText('کد پستی',{exact:true}),{target:{value:'۰۰۰۰۰۰۰۰۰۰'}})
  fireEvent.blur(screen.getByLabelText('کد پستی',{exact:true}))
  expect(screen.getByText('شماره همراه ایران درست نیست.')).toBeTruthy()
  expect(screen.getByText('کد پستی ده رقمی درست نیست.')).toBeTruthy()
  submit()
  expect(mocked.mock.calls.filter(([path])=>path==='/orders')).toHaveLength(0)
})
it('recovers a lost response using the frozen request even after closing and changing the basket',async()=>{
  let attempts=0
  mocked.mockImplementation(async path=>{if(path==='/quote')return quote;if(path==='/orders'){if(++attempts===1)throw new Error('پاسخ سفارش نرسید');return {order,receiptToken:'c'.repeat(43)}}return {} as never})
  const completed=vi.fn()
  const props={user:null,onClose:()=>{},onComplete:completed}
  const first=render(<CheckoutDialog {...props} items={items}/>);await fill()
  fireEvent.change(screen.getByLabelText('یادداشت سفارش، اختیاری'),{target:{value:'یادداشت اول'}})
  submit();await screen.findByRole('alert')
  expect((screen.getByLabelText('نشانی کامل') as HTMLTextAreaElement).disabled).toBe(true)
  expect((screen.getByLabelText('یادداشت سفارش، اختیاری') as HTMLTextAreaElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('نشانی کامل'),{target:{value:'ویرایش پس از پاسخ نامشخص'}})
  const warning=new Event('beforeunload',{cancelable:true})
  window.dispatchEvent(warning)
  expect(warning.defaultPrevented).toBe(false)
  expect(sessionStorage.getItem('autokala.pending-order.v1')).toBeTruthy()
  first.unmount()
  const closedWarning=new Event('beforeunload',{cancelable:true})
  window.dispatchEvent(closedWarning)
  expect(closedWarning.defaultPrevented).toBe(false)
  render(<CheckoutDialog {...props} items={[{productId:2,quantity:7}]}/>)
  expect((screen.getByLabelText('نشانی کامل') as HTMLTextAreaElement).value).toBe(order.customer.address)
  expect(screen.getByText(/نتیجه درخواست قبلی روشن نیست/)).toBeTruthy()
  submit();await screen.findByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')
  const bodies=mocked.mock.calls.filter(([path])=>path==='/orders').map(([,options])=>JSON.parse(options!.body as string))
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
  expect(bodies[1].items).toEqual(items)
  expect(bodies[1].note).toBe('یادداشت اول')
  expect(completed).toHaveBeenCalledWith(items)
  expect(sessionStorage.getItem('autokala.pending-order.v1')).toBeNull()
  const settled=new Event('beforeunload',{cancelable:true})
  window.dispatchEvent(settled)
  expect(settled.defaultPrevented).toBe(false)
})
it('restores a validated pending request from session storage and clears it after recovery',async()=>{
  const body={items,customer:order.customer,note:'خط اول\nخط دوم',idempotencyKey:'pending-order-key-12345678',expectedTotal:quote.total}
  sessionStorage.setItem('autokala.pending-order.v1',JSON.stringify({body,quote,ownerId:null}))
  mocked.mockResolvedValue({order,receiptToken:'e'.repeat(43)} as never)
  render(<CheckoutDialog items={[{productId:2,quantity:4}]} user={null} onClose={()=>{}} onComplete={()=>{}}/>)
  expect((screen.getByLabelText('نشانی کامل') as HTMLTextAreaElement).value).toBe(order.customer.address)
  expect((screen.getByLabelText('نشانی کامل') as HTMLTextAreaElement).disabled).toBe(true)
  expect(mocked.mock.calls.filter(([path])=>path==='/quote')).toHaveLength(0)
  submit();await screen.findByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')
  expect(JSON.parse(mocked.mock.calls[0][1]!.body as string)).toEqual(body)
  expect(sessionStorage.getItem('autokala.pending-order.v1')).toBeNull()
})
it('rejects corrupt pending storage instead of restoring an unsafe basket',async()=>{
  sessionStorage.setItem('autokala.pending-order.v1',JSON.stringify({body:{items:[{productId:1,quantity:100}],customer:order.customer,note:'',idempotencyKey:'pending-order-key-12345678',expectedTotal:quote.total},quote,ownerId:null}))
  mocked.mockResolvedValue(quote as never)
  render(<CheckoutDialog items={items} user={null} onClose={()=>{}} onComplete={()=>{}}/>);await fill()
  expect(sessionStorage.getItem('autokala.pending-order.v1')).toBeNull()
  expect((screen.getByLabelText('نشانی کامل') as HTMLTextAreaElement).disabled).toBe(false)
})
it('warns before reload when session storage is blocked and still recovers within the visit',async()=>{
  const setItem=Storage.prototype.setItem
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){if(this===sessionStorage)throw new Error('Storage blocked');setItem.call(this,key,value)})
  let attempts=0
  mocked.mockImplementation(async path=>{if(path==='/quote')return quote;if(path==='/orders'){if(++attempts===1)throw new Error('پاسخ نرسید');return {order,receiptToken:'f'.repeat(43)}}return {} as never})
  const props={items,user:null,onClose:()=>{},onComplete:()=>{}}
  const first=render(<CheckoutDialog {...props}/>);await fill();submit();await screen.findByRole('alert')
  expect(screen.getByText(/ذخیره موقت مرورگر در دسترس نیست/)).toBeTruthy()
  first.unmount()
  const warning=new Event('beforeunload',{cancelable:true});window.dispatchEvent(warning)
  expect(warning.defaultPrevented).toBe(true)
  render(<CheckoutDialog {...props}/>);submit();await screen.findByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')
  const settled=new Event('beforeunload',{cancelable:true});window.dispatchEvent(settled)
  expect(settled.defaultPrevented).toBe(false)
})

it('shows authoritative quote lines and totals and keeps optional notes across collapse',async()=>{
  mocked.mockResolvedValue(quote as never)
  render(<CheckoutDialog items={items} user={null} onClose={()=>{}} onComplete={()=>{}}/>);await fill()
  const summary=screen.getByRole('complementary',{name:'خلاصه سفارش'})
  expect(within(summary).getByRole('heading',{name:'کالای نمونه'})).toBeTruthy()
  expect(within(summary).getByText('جمع کالاها').nextElementSibling?.textContent).toContain('۲۰۰')
  const toggle=screen.getByRole('button',{name:'افزودن یادداشت سفارش اختیاری'})
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(toggle)
  fireEvent.change(screen.getByLabelText('یادداشت سفارش، اختیاری'),{target:{value:'یادداشت ساختگی'}})
  fireEvent.click(toggle);fireEvent.click(toggle)
  expect((screen.getByLabelText('یادداشت سفارش، اختیاری') as HTMLTextAreaElement).value).toBe('یادداشت ساختگی')
})
it('brings a failed request into focus and focuses the receipt after recovery',async()=>{
  let attempts=0
  mocked.mockImplementation(async path=>{if(path==='/quote')return quote;if(path==='/orders'){if(++attempts===1)throw new Error('خطای ساختگی');return {order}}return {} as never})
  render(<CheckoutDialog items={items} user={null} onClose={()=>{}} onComplete={()=>{}}/>);await fill();submit()
  const alert=await screen.findByRole('alert');expect(document.activeElement).toBe(alert)
  submit();const success=await screen.findByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')
  expect(document.activeElement).toBe(success)
})
