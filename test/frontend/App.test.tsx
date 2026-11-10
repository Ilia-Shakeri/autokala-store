import { beforeEach,it,expect,vi } from 'vitest'
import { render,screen,waitFor,fireEvent,act } from '@testing-library/react'
import App from '../../src/App'
import { api } from '../../src/api'

vi.mock('../../src/api',()=>({api:vi.fn(),json:JSON.stringify}))
vi.mock('../../src/Storefront',()=>({default:({catalog,onRefresh,onAccount}:{onAccount:()=>void;catalog:{products:{name:string}[]};onRefresh:()=>void})=> <main><span>فروشگاه عمومی</span><span data-testid="catalog-revision">{catalog.products[0]?.name}</span><button onClick={onRefresh}>دریافت کاتالوگ</button><button onClick={onAccount}>باز کردن حساب</button></main>}))
vi.mock('../../src/AdminPanel',()=>({default:()=> <main>پنل خصوصی</main>}))
vi.mock('../../src/CommerceDialogs',()=>({AccountDialog:({user,onAuthenticated}:{user:{name:string}|null;onAuthenticated:(user:unknown)=>void})=> <div>حساب مشتری {user?.name}<button onClick={()=>onAuthenticated({id:1,name:'مشتری واردشده',email:'buyer@example.test',role:'customer'})}>ورود نمونه</button></div>}))
const mocked=vi.mocked(api)
beforeEach(()=>mocked.mockReset())
const customer={id:1,name:'مشتری',email:'buyer@example.test',role:'customer'}
const admin={id:2,name:'مدیر',email:'manager@example.test',role:'admin'}
function bootstrap(isAdminHost:boolean,user:unknown){mocked.mockImplementation(async path=>path==='/context'?{isAdminHost,publicOrigin:'http://127.0.0.1:3001'}:path==='/session'?{user}:path==='/catalog'?{products:[],categories:[],vehicles:[],settings:{}}:{} as never)}

it('shows an accessible car while bootstrap is pending and removes it when ready',async()=>{
  let finish!:(value:unknown)=>void
  const context=new Promise(resolve=>{finish=resolve})
  mocked.mockImplementation(async path=>path==='/context'?context:path==='/session'?{user:null}:path==='/catalog'?{products:[],categories:[],vehicles:[],settings:{}}:{} as never)
  render(<App/>);expect(screen.getByRole('status').textContent).toContain('در حال دریافت فروشگاه')
  expect(document.querySelector('.car-loading-scene')).toBeTruthy()
  await act(async()=>finish({isAdminHost:false,publicOrigin:'http://127.0.0.1:3001'}))
  await screen.findByText('فروشگاه عمومی');expect(screen.queryByRole('status')).toBeNull()
})

it('never mounts management on the public host even if stale session data names an admin',async()=>{bootstrap(false,admin);render(<App/>);await screen.findByText('فروشگاه عمومی');expect(screen.queryByText('پنل خصوصی')).toBeNull();expect(screen.queryByText('مدیریت اتوکالا')).toBeNull()})
it('loads the private panel only with an admin session on the admin host',async()=>{bootstrap(true,admin);render(<App/>);await screen.findByText('پنل خصوصی');expect(screen.queryByText('فروشگاه عمومی')).toBeNull();expect(mocked.mock.calls.some(([path])=>path==='/catalog')).toBe(false)})
it('requires admin login for customers and has no public registration on that host',async()=>{bootstrap(true,customer);render(<App/>);await screen.findByRole('heading',{name:'مدیریت اتوکالا'});expect(screen.queryByText('پنل خصوصی')).toBeNull();expect(screen.queryByRole('button',{name:'ساخت حساب'})).toBeNull();expect(screen.getByRole('link',{name:'بازگشت به فروشگاه'}).getAttribute('href')).toBe('http://127.0.0.1:3001')})
it('retries a failed bootstrap instead of leaving a blank application',async()=>{mocked.mockRejectedValue(new Error('اتصال قطع است'));render(<App/>);await screen.findByRole('alert');bootstrap(false,null);fireEvent.click(screen.getByRole('button',{name:'تلاش دوباره'}));await waitFor(()=>expect(screen.getByText('فروشگاه عمومی')).toBeTruthy())})

it('keeps the newest catalog when an older refresh finishes last',async()=>{
  let older!:(value:unknown)=>void,newer!:(value:unknown)=>void
  let catalogCalls=0
  const catalog=(name:string)=>({products:[{name}],categories:[],vehicles:[],settings:{}})
  mocked.mockImplementation(async path=>{
    if(path==='/context')return {isAdminHost:false,publicOrigin:'http://127.0.0.1:3001'} as never
    if(path==='/session')return {user:null} as never
    if(path==='/catalog'){
      catalogCalls++
      if(catalogCalls===1)return catalog('کالای نخست') as never
      return new Promise(resolve=>{if(catalogCalls===2)older=resolve;else newer=resolve}) as never
    }
    return {} as never
  })
  render(<App/>)
  await screen.findByText('کالای نخست')
  fireEvent.click(screen.getByRole('button',{name:'دریافت کاتالوگ'}))
  fireEvent.click(screen.getByRole('button',{name:'دریافت کاتالوگ'}))
  await act(async()=>newer(catalog('کالای تازه')))
  expect(screen.getByTestId('catalog-revision').textContent).toBe('کالای تازه')
  await act(async()=>older(catalog('کالای کهنه')))
  expect(screen.getByTestId('catalog-revision').textContent).toBe('کالای تازه')
})

it('keeps the customer dialog open after successful authentication to show the account',async()=>{
  bootstrap(false,null);render(<App/>);await screen.findByText('فروشگاه عمومی')
  fireEvent.click(screen.getByRole('button',{name:'باز کردن حساب'}))
  fireEvent.click(screen.getByRole('button',{name:'ورود نمونه'}))
  expect(screen.getByText('حساب مشتری مشتری واردشده')).toBeTruthy()
})
