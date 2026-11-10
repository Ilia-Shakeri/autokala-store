import {beforeEach,it,expect,vi} from 'vitest'
import {render,screen,act,fireEvent} from '@testing-library/react'
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
