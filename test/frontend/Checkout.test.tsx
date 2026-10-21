import { beforeEach,it,expect,vi } from 'vitest'
import { render,screen,fireEvent,waitFor } from '@testing-library/react'
import { CheckoutDialog } from '../../src/CommerceDialogs'
import { api,ApiError } from '../../src/api'

vi.mock('../../src/api',async importOriginal=>({...await importOriginal<typeof import('../../src/api')>(),api:vi.fn()}))
const mocked=vi.mocked(api)
const items=[{productId:1,quantity:2}]
const quote={subtotal:200,shipping:10,total:210,items:[{productId:1,name:'کالای نمونه',price:100,quantity:2,lineTotal:200}]}
const order={id:'AK-ABCDEF0123456789',customer:{name:'کاربر نمونه',email:'buyer@example.test',phone:'09123456789',address:'نشانی ساختگی برای آزمون، پلاک ۱۲',postalCode:'1234567890'},items:quote.items,subtotal:200,shipping:10,total:210,status:'pending_payment',createdAt:new Date().toISOString()}
beforeEach(()=>mocked.mockReset())
async function fill(){await waitFor(()=>expect((screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement).disabled).toBe(false));for(const [name,value] of [['نام و نام خانوادگی','کاربر نمونه'],['موبایل گیرنده','09123456789'],['ایمیل رسید','buyer@example.test'],['کد پستی','1234567890'],['نشانی کامل','نشانی ساختگی برای آزمون، پلاک ۱۲']])fireEvent.change(screen.getByLabelText(name,{exact:true}),{target:{value}})}
function submit(){fireEvent.submit(screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}).closest('form')!)}

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
