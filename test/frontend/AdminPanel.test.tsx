import { beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdminPanel from '../../src/AdminPanel'
import { api } from '../../src/api'
import type { Order, Product } from '../../src/types'

vi.mock('../../src/api', async () => ({ ...await vi.importActual('../../src/api'), api: vi.fn() }))
vi.mock('../../src/ProductImage', () => ({ ProductImage: () => <span /> }))
const mocked = vi.mocked(api)
const admin = { id: 1, name: 'مدیر', email: 'manager@example.test', role: 'admin' as const }
const product: Product = { id: 1, name: 'روغن اصلی', sku: 'OIL-1', brand: 'برند', price: 100000, oldPrice: null, category: 'روغن', label: '', visual: 'oil', color: 'amber', description: 'شرح کامل کالای فروشگاه', stock: 10, vehicles: ['پژو'] }
const order: Order = { id: 'AK-TEST-0001', customer: { name: 'مشتری', email: 'buyer@example.test', phone: '09121234567', address: 'نشانی کامل مشتری', postalCode: '1234567890' }, items: [{ productId: 1, name: product.name, price: product.price, quantity: 1, lineTotal: product.price }], subtotal: product.price, shipping: 0, total: product.price, status: 'pending_payment', createdAt: '2026-11-10T08:00:00Z', expiresAt: '2026-11-11T08:00:00Z' }
const pagination = { total: 1, limit: 50, offset: 0, hasMore: false }
const overview = { products: [product, { ...product, id: 2, sku: 'FLT-1', name: 'فیلتر روغن ویژه', category: 'فیلتر' }], categories: [{ id: 1, title: 'روغن', icon: 'oil', count: 1 }, { id: 2, title: 'فیلتر', icon: 'filter', count: 1 }], orders: [order], pagination, metrics: { revenue: 0, orders: 1, lowStock: 0, customers: 1, subscribers: 0 }, reports: { byStatus: [{ status: 'pending_payment', count: 1, total: order.total }], byDay: [] } }
function show() { return render(<AdminPanel user={admin} onStore={() => {}} onLogout={() => {}} onCatalogChange={() => {}} />) }
beforeEach(() => {
  mocked.mockReset()
  mocked.mockImplementation(async (path, options) => {
    if (path.startsWith('/admin/overview')) return overview as never
    if (path.startsWith('/admin/orders?')) return { orders: [order], pagination } as never
    if (path === '/catalog') return { vehicles: [] } as never
    if (path === `/admin/orders/${order.id}`) return { order: { ...order, ...JSON.parse(String(options?.body)) } } as never
    return {} as never
  })
})

it('opens category goods with an exact category filter and clears the old search', async () => {
  show()
  await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` })
  fireEvent.click(screen.getByRole('button', { name: 'محصولات', exact: true }))
  fireEvent.change(screen.getByRole('searchbox', { name: 'جست‌وجوی کالا' }), { target: { value: 'نام غایب' } })
  fireEvent.click(screen.getByRole('button', { name: 'دسته‌بندی‌ها', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'کالاهای روغن', exact: true }))
  expect(screen.getByText('روغن اصلی')).toBeTruthy()
  expect(screen.queryByText('فیلتر روغن ویژه')).toBeNull()
  expect(screen.getByRole('searchbox', { name: 'جست‌وجوی کالا' }).getAttribute('value')).toBe('')
})

it('sends only edited product fields so a name edit cannot restore sold stock', async () => {
  show()
  await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` })
  fireEvent.click(screen.getByRole('button', { name: 'محصولات', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'ویرایش روغن اصلی' }))
  const name = screen.getByLabelText('نام کامل کالا')
  fireEvent.change(name, { target: { value: 'روغن با نام تازه' } })
  fireEvent.submit(name.closest('form')!)
  await waitFor(() => expect(mocked.mock.calls.some(([path, options]) => path === '/admin/products/1' && options?.method === 'PATCH')).toBe(true))
  const [, options] = mocked.mock.calls.find(([path]) => path === '/admin/products/1')!
  expect(JSON.parse(String(options?.body))).toEqual({ name: 'روغن با نام تازه' })
})

it('guards an intentional stock edit with the opening stock value', async () => {
  show()
  await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` })
  fireEvent.click(screen.getByRole('button', { name: 'محصولات', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'ویرایش روغن اصلی' }))
  const stock = screen.getByLabelText('موجودی قابل فروش')
  fireEvent.change(stock, { target: { value: '20' } })
  fireEvent.submit(stock.closest('form')!)
  await waitFor(() => expect(mocked.mock.calls.some(([path]) => path === '/admin/products/1')).toBe(true))
  const [, options] = mocked.mock.calls.find(([path]) => path === '/admin/products/1')!
  expect(JSON.parse(String(options?.body))).toEqual({ stock: 20, expectedStock: 10 })
})

it('keeps an unchanged product save local and closes the form', async () => {
  show()
  await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` })
  fireEvent.click(screen.getByRole('button', { name: 'محصولات', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'ویرایش روغن اصلی' }))
  fireEvent.submit(screen.getByLabelText('نام کامل کالا').closest('form')!)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(mocked.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false)
})

it('requires a separate confirmation before cancellation and lets the manager keep the order', async () => {
  show()
  fireEvent.click(await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` }))
  expect(screen.getByText(/پایان رزرو موجودی/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'لغو سفارش و بازگرداندن موجودی' }))
  expect(mocked.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'نگه‌داشتن سفارش' }))
  expect(screen.queryByRole('button', { name: 'تأیید لغو سفارش' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'لغو سفارش و بازگرداندن موجودی' }))
  fireEvent.click(screen.getByRole('button', { name: 'تأیید لغو سفارش' }))
  await waitFor(() => expect(mocked.mock.calls.some(([path, options]) => path === `/admin/orders/${order.id}` && JSON.parse(String(options?.body)).status === 'cancelled')).toBe(true))
})

it('makes the phone background inert and releases the menu on desktop resize', async () => {
  let listener = () => {}
  const media = { matches: true, media: '(max-width:760px)', onchange: null, addListener() {}, removeListener() {}, addEventListener: (_: string, fn: () => void) => { listener = fn }, removeEventListener() {}, dispatchEvent: () => false }
  vi.spyOn(window, 'matchMedia').mockReturnValue(media)
  show()
  await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` })
  const menu = screen.getByRole('button', { name: 'باز کردن فهرست مدیریت' })
  menu.focus()
  fireEvent.click(menu)
  expect(document.querySelector('.admin-content')?.hasAttribute('inert')).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  expect(screen.getByRole('dialog', { name: 'فهرست مدیریت' })).toBeTruthy()
  act(() => { media.matches = false; listener() })
  expect(document.querySelector('.admin-content')?.hasAttribute('inert')).toBe(false)
  expect(document.body.style.overflow).toBe('')
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('never presents old order matches after a new search fails and retries the current search', async () => {
  show()
  await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` })
  fireEvent.click(screen.getByRole('button', { name: /سفارش‌ها/ }))
  await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` })
  mocked.mockImplementation(async path => {
    if (path.startsWith('/admin/orders?')) throw new Error('جست‌وجو دریافت نشد')
    return overview as never
  })
  fireEvent.change(screen.getByRole('searchbox', { name: 'جست‌وجو در همه سفارش‌ها' }), { target: { value: 'نام تازه' } })
  expect(screen.queryByRole('button', { name: `جزئیات سفارش ${order.id}` })).toBeNull()
  await screen.findByText('جست‌وجو دریافت نشد')
  expect(screen.queryByText('سفارشی با این مشخصات پیدا نشد.')).toBeNull()
  mocked.mockResolvedValue({ orders: [], pagination: { ...pagination, total: 0 } } as never)
  fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
  await screen.findByText('سفارشی با این مشخصات پیدا نشد.')
  expect(mocked.mock.calls.at(-1)?.[0]).toContain(new URLSearchParams({ query: 'نام تازه' }).toString())
})

it('keeps a failed category draft, blocks duplicate writes, and allows a successful retry', async () => {
  let rejectWrite!: (cause: Error) => void
  show()
  await screen.findByRole('button', { name: `جزئیات سفارش ${order.id}` })
  fireEvent.click(screen.getByRole('button', { name: 'دسته‌بندی‌ها', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'دسته تازه' }))
  const title = screen.getByLabelText('نام دسته')
  fireEvent.change(title, { target: { value: 'جلوبندی' } })
  mocked.mockImplementation(async (path, options) => {
    if (path === '/admin/categories' && options?.method === 'POST') return new Promise((_, reject) => { rejectWrite = reject })
    return overview as never
  })
  fireEvent.submit(title.closest('form')!)
  fireEvent.submit(title.closest('form')!)
  expect(mocked.mock.calls.filter(([path]) => path === '/admin/categories')).toHaveLength(1)
  expect((title as HTMLInputElement).closest('fieldset')?.disabled).toBe(true)
  await act(async () => rejectWrite(new Error('دسته ذخیره نشد')))
  expect(screen.getByRole('alert').textContent).toBe('دسته ذخیره نشد')
  expect((title as HTMLInputElement).value).toBe('جلوبندی')
  mocked.mockImplementation(async path => path.startsWith('/admin/overview') ? overview as never : {} as never)
  fireEvent.submit(title.closest('form')!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('status').textContent).toContain('دسته تازه ساخته شد')
})
