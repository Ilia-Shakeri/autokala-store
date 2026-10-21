import {it,expect,vi} from 'vitest'
import {render,screen,act} from '@testing-library/react'
import {AccountDialog} from '../../src/CommerceDialogs'
import {api} from '../../src/api'
vi.mock('../../src/api',async original=>({...await original<typeof import('../../src/api')>(),api:vi.fn()}))
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
