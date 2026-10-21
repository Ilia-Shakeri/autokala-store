import { beforeEach,it,expect,vi } from 'vitest'
import { render,screen,waitFor,fireEvent } from '@testing-library/react'
import App from '../../src/App'
import { api } from '../../src/api'

vi.mock('../../src/api',()=>({api:vi.fn(),json:JSON.stringify}))
vi.mock('../../src/Storefront',()=>({default:()=> <main>فروشگاه عمومی</main>}))
vi.mock('../../src/AdminPanel',()=>({default:()=> <main>پنل خصوصی</main>}))
vi.mock('../../src/CommerceDialogs',()=>({AccountDialog:()=> <div>حساب مشتری</div>}))
const mocked=vi.mocked(api)
beforeEach(()=>mocked.mockReset())
const customer={id:1,name:'مشتری',email:'buyer@example.test',role:'customer'}
const admin={id:2,name:'مدیر',email:'manager@example.test',role:'admin'}
function bootstrap(isAdminHost:boolean,user:unknown){mocked.mockImplementation(async path=>path==='/context'?{isAdminHost,publicOrigin:'http://127.0.0.1:3001'}:path==='/session'?{user}:path==='/catalog'?{products:[],categories:[],vehicles:[],settings:{}}:{} as never)}

it('never mounts management on the public host even if stale session data names an admin',async()=>{bootstrap(false,admin);render(<App/>);await screen.findByText('فروشگاه عمومی');expect(screen.queryByText('پنل خصوصی')).toBeNull();expect(screen.queryByText('مدیریت اتوکالا')).toBeNull()})
it('loads the private panel only with an admin session on the admin host',async()=>{bootstrap(true,admin);render(<App/>);await screen.findByText('پنل خصوصی');expect(screen.queryByText('فروشگاه عمومی')).toBeNull();expect(mocked.mock.calls.some(([path])=>path==='/catalog')).toBe(false)})
it('requires admin login for customers and has no public registration on that host',async()=>{bootstrap(true,customer);render(<App/>);await screen.findByRole('heading',{name:'مدیریت اتوکالا'});expect(screen.queryByText('پنل خصوصی')).toBeNull();expect(screen.queryByRole('button',{name:'ساخت حساب'})).toBeNull();expect(screen.getByRole('link',{name:'بازگشت به فروشگاه'}).getAttribute('href')).toBe('http://127.0.0.1:3001')})
it('retries a failed bootstrap instead of leaving a blank application',async()=>{mocked.mockRejectedValue(new Error('اتصال قطع است'));render(<App/>);await screen.findByRole('alert');bootstrap(false,null);fireEvent.click(screen.getByRole('button',{name:'تلاش دوباره'}));await waitFor(()=>expect(screen.getByText('فروشگاه عمومی')).toBeTruthy())})
