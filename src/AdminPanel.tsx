import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { api, json, normalize } from './api'
import { Modal } from './Modal'
import { LoadingCar } from './LoadingCar'
import { ActionButton } from './ActionButton'
import { ProductImage } from './ProductImage'
import { Select } from './Select'
import { formatPrice, Icon, Logo, categoryIcon, type IconName } from './ui'
import { statusLabels, type Order, type Overview, type Product, type User, type Category, type Catalog } from './types'
import './admin.css'

type Tab = 'داشبورد' | 'سفارش‌ها' | 'محصولات' | 'دسته‌بندی‌ها' | 'گزارش فروش' | 'راه‌اندازی فروشگاه'
type ProductInput = Omit<Product, 'id'>
type OrderPage = { orders: Order[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }
type AdminOverview = Overview & OrderPage & { metrics: Overview['metrics'] & { subscribers: number }; reports: { byStatus: { status: string; count: number; total: number }[]; byDay: { date: string; count: number; total: number }[] } }
const tabs: { title: Tab; icon: IconName }[] = [
  { title: 'داشبورد', icon: 'dashboard' }, { title: 'سفارش‌ها', icon: 'orders' },
  { title: 'محصولات', icon: 'box' }, { title: 'دسته‌بندی‌ها', icon: 'grid' },
  { title: 'گزارش فروش', icon: 'chart' }, { title: 'راه‌اندازی فروشگاه', icon: 'store' },
]
const nextStatus: Record<string, string> = { pending_payment: 'paid', paid: 'processing', processing: 'shipped', shipped: 'completed' }
const actionLabels: Record<string, string> = { paid: 'تأیید دریافت وجه', processing: 'شروع آماده‌سازی', shipped: 'ثبت ارسال سفارش', completed: 'ثبت تحویل سفارش' }
const paidStatuses = new Set(['paid', 'processing', 'shipped', 'completed'])
const dateFormatter = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' })
const dayFormatter = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeZone: 'Asia/Tehran' })
const dateLabel = (value: string) => dateFormatter.format(new Date(value))
const orderPageUrl = (offset: number, query: string, status: string) => `/admin/orders?${new URLSearchParams({ offset: String(offset), limit: '50', query, status })}`
async function fetchOrderPage(offset: number, query: string, status: string): Promise<OrderPage> {
  const page = await api<OrderPage>(orderPageUrl(offset, query, status))
  if (offset > 0 && offset >= page.pagination.total) return api<OrderPage>(orderPageUrl(Math.max(0, Math.floor((page.pagination.total - 1) / 50) * 50), query, status))
  return page
}
const reportDayLabel = (value: string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(new Date(`${value}T12:00:00+03:30`))

function ProductForm({ product, categories, busy, error, onSave, onClose }: {
  product: Product | null; categories: Category[]; busy: boolean; error: string;
  onSave: (value: ProductInput) => void; onClose: () => void;
}) {
  const [vehicleModels, setVehicleModels] = useState<string[]>([])
  useEffect(() => {
    let current = true
    void api<Catalog>('/catalog').then(catalog => { if (current) setVehicleModels(catalog.vehicles.map(vehicle => vehicle.model)) }).catch(() => {})
    return () => { current = false }
  }, [])
  const [form, setForm] = useState({
    name: product?.name || '', sku: product?.sku || '', brand: product?.brand || '',
    price: product ? String(product.price) : '', oldPrice: product?.oldPrice ? String(product.oldPrice) : '',
    stock: product ? String(product.stock) : '0', category: product?.category || categories[0]?.title || '',
    label: product?.label || '', visual: product?.visual || 'oil', color: product?.color || 'amber',
    description: product?.description || '', vehicles: product?.vehicles.join('، ') || '',
  })
  const field = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    onSave({ ...form, name: form.name.trim(), sku: form.sku.trim(), brand: form.brand.trim(),
      description: form.description.trim(), label: form.label.trim(), price: Number(form.price),
      oldPrice: form.oldPrice ? Number(form.oldPrice) : null, stock: Number(form.stock),
      vehicles: [...new Set(form.vehicles.split(/[,،\n]/).map(value => value.trim()).filter(Boolean))],
    })
  }
  return <form onSubmit={submit} className="admin-form">
    <p className="admin-hint">مشخصات و کد فنی را از روی بسته‌بندی کالا وارد کنید. قیمت‌ها به تومان هستند.</p>
    <fieldset className="admin-form-fields" disabled={busy}>
    <div className="form-grid">
      <label>نام کامل کالا<input required minLength={3} maxLength={180} value={form.name} onChange={e => field('name', e.target.value)} placeholder="فیلتر هوای سرکان مناسب پژو ۲۰۶ تیپ ۲" /></label>
      <label>کد کالا (SKU)<input required minLength={2} maxLength={64} value={form.sku} onChange={e => field('sku', e.target.value)} placeholder="FLT-SRK-206-A" dir="ltr" /></label>
      <label>برند<input required minLength={2} maxLength={80} value={form.brand} onChange={e => field('brand', e.target.value)} placeholder="سرکان" /></label>
      <label>دسته‌بندی<Select label="دسته‌بندی کالا" required disabled={busy} value={form.category} onValueChange={value => field('category', value)} options={categories.map(category => ({value:category.title,label:category.title}))} /></label>
      <label>قیمت فروش (تومان)<input required type="number" min="1" max="1000000000" step="1" inputMode="numeric" value={form.price} onChange={e => field('price', e.target.value)} placeholder="245000" /></label>
      <label>قیمت پیش از تخفیف (اختیاری)<input type="number" min={form.price || '1'} max="1000000000" step="1" inputMode="numeric" value={form.oldPrice} onChange={e => field('oldPrice', e.target.value)} placeholder="بدون تخفیف، خالی بماند" /></label>
      <label>موجودی قابل فروش<input required type="number" min="0" max="1000000" step="1" inputMode="numeric" value={form.stock} onChange={e => field('stock', e.target.value)} /></label>
      <label>برچسب کوتاه (اختیاری)<input maxLength={30} value={form.label} onChange={e => field('label', e.target.value)} placeholder="بسته ۴ عددی" /></label>
      <label>تصویر نمایشی<Select label="نوع نمای جایگزین" value={form.visual} disabled={busy} onValueChange={value => field('visual', value)} options={[{value:'oil',label:'روغن موتور'},{value:'filter',label:'فیلتر'},{value:'brake',label:'لنت و ترمز'},{value:'coolant',label:'ضدیخ'},{value:'spark',label:'شمع'},{value:'wiper',label:'برف‌پاک‌کن'},{value:'spray',label:'پاک‌کننده'}]} /></label>
      <label>رنگ زمینه<Select label="رنگ زمینه" value={form.color} disabled={busy} onValueChange={value => field('color', value)} options={[{value:'amber',label:'کهربایی'},{value:'cream',label:'کرم'},{value:'red',label:'خاکستری گرم'},{value:'blue',label:'آبی روشن'}]} /></label>
    </div>
    <label className="description-field">خودروهای سازگار<input maxLength={1000} value={form.vehicles} onChange={e => field('vehicles', e.target.value)} placeholder="پژو ۴۰۵، سمند EF7" /><small>نام مدل‌ها با ویرگول جدا شود؛ نام دقیق مدل در فیلتر فروشگاه به کار می‌رود.</small></label>
    {vehicleModels.length > 0 && <div className="admin-vehicle-options" aria-label="افزودن مدل سازگار">{vehicleModels.map(model => { const selected = form.vehicles.split(/[,،\n]/).map(value => value.trim()).includes(model); return <button type="button" key={model} aria-pressed={selected} onClick={() => field('vehicles', [...new Set([...form.vehicles.split(/[,،\n]/).map(value => value.trim()).filter(value => value && value !== model), ...(!selected ? [model] : [])])].join('، '))}>{model}{selected && <Icon name="check" size={12} />}</button> })}</div>}
    <label className="description-field">مشخصات و راهنمای تطبیق<textarea required minLength={10} maxLength={2000} value={form.description} onChange={e => field('description', e.target.value)} placeholder="نوع موتور، کد فنی، تعداد در بسته و نکته لازم پیش از نصب را بنویسید." /></label>
    </fieldset>
    {error && <p role="alert" className="admin-form-error">{error}</p>}
    <div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>انصراف</button><ActionButton type="submit" pending={busy} disabled={!categories.length} pendingLabel="در حال ذخیره…">ذخیره کالا<Icon name="check" size={18}/></ActionButton></div>
  </form>
}

function CategoryForm({ busy, error, onSave, onClose }: {busy: boolean; error: string; onSave: (title: string, icon: string) => void; onClose: () => void}) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('oil')
  return <form className="admin-form" onSubmit={event => { event.preventDefault(); if (!busy) onSave(title.trim(), icon) }}>
    <fieldset className="admin-form-fields" disabled={busy}>
    <div className="form-grid"><label>نام دسته<input required minLength={2} maxLength={80} value={title} onChange={e => setTitle(e.target.value)} placeholder="قطعات جلوبندی" /></label>
      <label>نماد دسته<Select label="نماد دسته" value={icon} disabled={busy} onValueChange={setIcon} options={[{value:'oil',label:'روغن و سیالات'},{value:'filter',label:'فیلتر'},{value:'brake',label:'ترمز'},{value:'spark',label:'برق'},{value:'wiper',label:'برف‌پاک‌کن'},{value:'spray',label:'نظافت'}]} /></label></div>
    </fieldset>
    {error && <p role="alert" className="admin-form-error">{error}</p>}
    <div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>انصراف</button><ActionButton type="submit" pending={busy}>ساخت دسته<Icon name="check" size={18}/></ActionButton></div>
  </form>
}

export default function AdminPanel({ onStore, user, onLogout, onCatalogChange }: {onStore: () => void; user: User; onLogout: () => void; onCatalogChange: () => void}) {
  const [active, setActive] = useState<Tab>('داشبورد')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [orderPage, setOrderPage] = useState<OrderPage | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [writeError, setWriteError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [productModal, setProductModal] = useState<{product: Product | null} | null>(null)
  const [categoryModal, setCategoryModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [paymentChecked, setPaymentChecked] = useState(false)
  const [orderFilter, setOrderFilter] = useState('all')
  const [orderSearch, setOrderSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [updated, setUpdated] = useState<Date | null>(null)
  const requestId = useRef(0)
  const orderRequestId = useRef(0)
  const orderOffset = useRef(0)
  const requestedOffset = useRef(0)
  const orderQuery = useRef({ query: '', status: 'all' })
  orderQuery.current = { query: orderSearch, status: orderFilter }
  const writeLock = useRef(false)
  const sidebarPanel = useRef<HTMLElement>(null)

  const refresh = useCallback(async () => {
    const id = ++requestId.current
    const pageId = ++orderRequestId.current
    setLoading(true)
    setOrdersLoading(false)
    setError('')
    try {
      const [result, currentPage] = await Promise.all([
        api<AdminOverview>('/admin/overview?offset=0&limit=50'),
        orderOffset.current || orderQuery.current.query || orderQuery.current.status !== 'all' ? fetchOrderPage(orderOffset.current, orderQuery.current.query, orderQuery.current.status) : Promise.resolve(null),
      ])
      if (id !== requestId.current) return
      setOverview(result)
      if (pageId === orderRequestId.current) { const page = currentPage || result; setOrderPage(page); orderOffset.current = page.pagination.offset; setOrdersError(''); setOrdersLoading(false) }
      setUpdated(new Date())
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : 'اطلاعات فروشگاه دریافت نشد.')
    } finally { if (id === requestId.current) setLoading(false) }
  }, [])

  const loadOrders = useCallback(async (offset: number) => {
    const id = ++orderRequestId.current
    requestedOffset.current = offset
    setOrdersLoading(true)
    setOrdersError('')
    try {
      const result = await fetchOrderPage(offset, orderQuery.current.query, orderQuery.current.status)
      if (id !== orderRequestId.current) return
      setOrderPage(result)
      orderOffset.current = result.pagination.offset
    } catch (cause) { if (id === orderRequestId.current) setOrdersError(cause instanceof Error ? cause.message : 'صفحه سفارش‌ها دریافت نشد.') }
    finally { if (id === orderRequestId.current) setOrdersLoading(false) }
  }, [])

  useEffect(() => { void refresh(); return () => { requestId.current++; orderRequestId.current++ } }, [refresh])
  useEffect(() => {
    if (active !== 'سفارش‌ها') { setOrdersLoading(false); return }
    setOrdersLoading(true)
    const timer = window.setTimeout(() => void loadOrders(0), orderSearch ? 250 : 0)
    return () => { window.clearTimeout(timer); orderRequestId.current++ }
  }, [active, orderSearch, orderFilter, loadOrders])
  useEffect(() => {
    if (!sidebarOpen || !window.matchMedia('(max-width:760px)').matches) return
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const buttons = () => [...(sidebarPanel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])]
    buttons()[0]?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setSidebarOpen(false) }
      if (event.key !== 'Tab') return
      const list = buttons(), first = list[0], last = list.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [sidebarOpen])

  const mutate = async (action: () => Promise<unknown>, message: string, after?: () => void, catalogChange = false) => {
    if (writeLock.current) return
    writeLock.current = true
    setBusy(true)
    setWriteError('')
    setNotice('')
    try {
      await action()
      setNotice(message)
      after?.()
      await refresh()
      if (catalogChange) onCatalogChange()
    } catch (cause) { setWriteError(cause instanceof Error ? cause.message : 'تغییر ذخیره نشد. دوباره تلاش کنید.') }
    finally { setBusy(false); writeLock.current = false }
  }

  const orders = (active === 'سفارش‌ها' ? orderPage?.orders : overview?.orders) || []
  const products = overview?.products || []
  const categories = overview?.categories || []
  const pending = overview?.reports.byStatus.find(row => row.status === 'pending_payment')?.count || 0
  const filteredOrders = orders
  const filteredProducts = useMemo(() => products.filter(product => normalize(`${product.name} ${product.sku} ${product.brand} ${product.category}`).includes(normalize(productSearch))), [products, productSearch])
  const report = useMemo(() => {
    const paid = (overview?.reports.byStatus || []).filter(row => paidStatuses.has(row.status))
    const count = paid.reduce((sum, row) => sum + row.count, 0)
    const revenue = paid.reduce((sum, row) => sum + row.total, 0)
    return { count, revenue, average: count ? Math.round(revenue / count) : 0 }
  }, [overview])

  const showOrder = (id: string) => { setSelectedOrder(orderPage?.orders.find(order => order.id === id) || overview?.orders.find(order => order.id === id) || null); setPaymentChecked(false); setWriteError('') }
  const openProduct = (product: Product | null = null) => { setProductModal({ product }); setWriteError('') }
  const closeProduct = () => { if (!writeLock.current) { setProductModal(null); setWriteError('') } }
  const closeCategory = () => { if (!writeLock.current) { setCategoryModal(false); setWriteError('') } }
  const closeOrder = () => { if (!writeLock.current) { setSelectedOrder(null); setWriteError('') } }
  const changeStatus = (order: Order, status: string) => void mutate(async () => { const result = await api<{order: Order}>(`/admin/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: json({ status }) }); setSelectedOrder(result.order) }, `وضعیت سفارش به «${statusLabels[status]}» تغییر کرد.`, () => setPaymentChecked(false), status === 'cancelled')
  const saveProduct = (value: ProductInput) => {
    const productId = productModal?.product?.id
    void mutate(() => api(`/admin/products${productId ? `/${productId}` : ''}`, {method: productId ? 'PATCH' : 'POST', body: json(value)}), productId ? 'تغییرات کالا ذخیره شد.' : 'کالای تازه در فروشگاه ثبت شد.', () => setProductModal(null), true)
  }

  return <div className="admin" dir="rtl">
    {sidebarOpen && <button className="admin-sidebar-backdrop" aria-label="بستن فهرست مدیریت" onClick={() => setSidebarOpen(false)} />}
    <aside ref={sidebarPanel} className={sidebarOpen ? 'admin-sidebar open' : 'admin-sidebar'} aria-label="فهرست مدیریت" role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen ? true : undefined}>
      <div className="sidebar-logo"><Logo light /><button aria-label="بستن فهرست مدیریت" onClick={() => setSidebarOpen(false)}><Icon name="x" /></button></div>
      <div className="admin-profile"><span>{user.name.slice(0, 2)}</span><p><strong>{user.name}</strong><small dir="ltr">{user.email}</small></p></div>
      <nav aria-label="مدیریت فروشگاه">{tabs.map(({title, icon}) => <button className={active === title ? 'active' : ''} aria-current={active === title ? 'page' : undefined} key={title} onClick={() => { setActive(title); setSidebarOpen(false); setWriteError('') }}><Icon name={icon} />{title}{title === 'سفارش‌ها' && pending > 0 && <b>{formatPrice(pending)}</b>}</button>)}</nav>
      <div className="admin-sidebar-footer"><button className="go-store" onClick={onStore}><Icon name="store" /> مشاهده فروشگاه</button><button className="go-store" onClick={onLogout}>خروج از حساب</button></div>
    </aside>
    <div className="admin-content"><p className="admin-demo-banner">داده‌ها ساختگی و نمایشی‌اند؛ این گزارش، فروش و ارسال واقعی نیست.</p>
      <header className="admin-header">
        <button className="admin-menu" aria-label="باز کردن فهرست مدیریت" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
        <div><span>{dayFormatter.format(new Date())}</span><h1>{active}</h1></div>
        <div className="admin-header-actions"><button type="button" className="admin-refresh" title="دریافت تازه‌ترین اطلاعات" aria-label="دریافت تازه‌ترین اطلاعات" disabled={loading || ordersLoading || busy} onClick={() => void refresh()}>{loading||ordersLoading?<LoadingCar inline iconOnly label="دریافت اطلاعات…"/>:<Icon name="refresh"/>}</button><button className="new-product" disabled={!overview || busy} onClick={() => openProduct()}><Icon name="plus" /> افزودن کالا</button></div>
      </header>
      <div className="admin-update" aria-live="polite">{loading ? <LoadingCar inline label="در حال دریافت اطلاعات…"/> : updated ? `آخرین دریافت: ${dateFormatter.format(updated)}` : ''}</div>
      {notice && <div className="admin-notice" role="status"><Icon name="check" size={18} />{notice}<button aria-label="بستن پیام" onClick={() => setNotice('')}><Icon name="x" size={16} /></button></div>}
      {error && <div className="admin-error" role="alert"><p>{error}</p><button disabled={loading} onClick={() => void refresh()}>تلاش دوباره</button></div>}
      {writeError && !productModal && !categoryModal && !selectedOrder && <p role="alert" className="admin-form-error">{writeError}</p>}
      {!overview && loading && <div className="admin-loading"><LoadingCar label="دریافت کالاها و سفارش‌ها…"/></div>}
      {overview && <>
        {active === 'داشبورد' && <>
          <section className="welcome-card"><div><span>مرور فروشگاه</span><h2>{user.name}، خوش آمدید.</h2><p>{pending ? `${formatPrice(pending)} سفارش در انتظار بررسی پرداخت است.` : 'سفارش در انتظار بررسی پرداخت ندارید.'} اطلاعات این صفحه از پایگاه داده فروشگاه خوانده می‌شود.</p></div><Icon name="store" size={70} /></section>
          <section className="metric-grid" aria-label="آمار فروشگاه"><div><span className="metric-icon green"><Icon name="chart" /></span><p><small>فروش تأییدشده، کل دوره</small><strong>{formatPrice(overview.metrics.revenue)} <em>تومان</em></strong></p></div><div><span className="metric-icon yellow"><Icon name="orders" /></span><p><small>کل سفارش‌ها</small><strong>{formatPrice(overview.metrics.orders)} <em>سفارش</em></strong></p></div><div><span className="metric-icon blue"><Icon name="box" /></span><p><small>کالای کم‌موجودی</small><strong>{formatPrice(overview.metrics.lowStock)} <em>کالا</em></strong></p></div><div><span className="metric-icon purple"><Icon name="user" /></span><p><small>مشتریان ثبت‌شده</small><strong>{formatPrice(overview.metrics.customers)} <em>نفر</em></strong></p></div></section>
        </>}

        {(active === 'داشبورد' || active === 'سفارش‌ها') && <section className="orders-panel">
          <div className="panel-heading"><div><h2>{active === 'داشبورد' ? 'سفارش‌های اخیر' : 'مدیریت سفارش‌ها'}</h2><span>{formatPrice(active === 'داشبورد' ? overview.metrics.orders : orderPage?.pagination.total || 0)} سفارش؛ جزئیات هر سفارش را برای بررسی باز کنید.</span></div></div>
          {active === 'سفارش‌ها' && <div className="admin-toolbar"><label>وضعیت سفارش<Select label="وضعیت سفارش" value={orderFilter} disabled={busy} onValueChange={setOrderFilter} options={[{value:'all',label:'همه وضعیت‌ها'},...Object.entries(statusLabels).map(([value,label])=>({value,label}))]} /></label><label className="admin-search">جست‌وجو در همه سفارش‌ها<input type="search" disabled={busy} value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="کد سفارش، نام مشتری، ایمیل یا موبایل" /></label></div>}
          {active === 'سفارش‌ها' && ordersError && <div className="admin-error" role="alert"><p>{ordersError}</p><button disabled={ordersLoading} onClick={() => void loadOrders(requestedOffset.current)}>تلاش دوباره</button></div>}
          {active === 'سفارش‌ها' && ordersLoading && <div className="admin-page-loading"><LoadingCar inline label="دریافت صفحه سفارش‌ها…"/></div>}
          <div className="order-table"><div role="table" aria-label="سفارش‌های فروشگاه"><div className="table-row table-head" role="row"><span role="columnheader">شماره سفارش</span><span role="columnheader">مشتری</span><span role="columnheader">مبلغ (تومان)</span><span role="columnheader">زمان ثبت</span><span role="columnheader">وضعیت</span><span role="columnheader">جزئیات</span></div>
            {(active === 'داشبورد' ? filteredOrders.slice(0, 8) : filteredOrders).map(order => <div className="table-row" key={order.id} role="row"><strong role="cell" className="admin-order-id" dir="ltr">{order.id}</strong><span role="cell" className="customer"><i>{order.customer.name.charAt(0)}</i>{order.customer.name}</span><b role="cell">{formatPrice(order.total)}</b><span role="cell">{dateLabel(order.createdAt)}</span><span role="cell"><i className={`status status-${order.status}`}>{statusLabels[order.status] || order.status}</i></span><span role="cell"><button className="confirm-btn" disabled={loading || ordersLoading || busy} onClick={() => showOrder(order.id)} aria-label={`جزئیات سفارش ${order.id}`}>بررسی</button></span></div>)}</div></div>
          {!filteredOrders.length && <p className="admin-empty">سفارشی با این مشخصات پیدا نشد.</p>}
          {active === 'داشبورد' && overview.metrics.orders > 8 && <button className="admin-all-orders" onClick={() => setActive('سفارش‌ها')}>مشاهده همه سفارش‌ها <Icon name="arrow" size={16} /></button>}
          {active === 'سفارش‌ها' && orderPage && <nav className="admin-pagination" aria-label="صفحه‌های سفارش"><span>{orderPage.pagination.total ? `${formatPrice(orderPage.pagination.offset + 1)} تا ${formatPrice(orderPage.pagination.offset + orderPage.orders.length)} از ${formatPrice(orderPage.pagination.total)} سفارش` : 'سفارشی پیدا نشد.'}</span><div><button disabled={loading || ordersLoading || busy || orderPage.pagination.offset === 0} onClick={() => void loadOrders(Math.max(0, orderPage.pagination.offset - orderPage.pagination.limit))}>صفحه قبل</button><button disabled={loading || ordersLoading || busy || !orderPage.pagination.hasMore} onClick={() => void loadOrders(orderPage.pagination.offset + orderPage.pagination.limit)}>صفحه بعد</button></div></nav>}
        </section>}

        {active === 'محصولات' && <section className="orders-panel products-admin"><div className="panel-heading"><div><h2>کالاهای فروشگاه</h2><span>{formatPrice(products.length)} کالا در پایگاه داده</span></div><button onClick={() => openProduct()}><Icon name="plus" size={18} /> کالای تازه</button></div><div className="admin-toolbar"><label className="admin-search">جست‌وجوی کالا<input type="search" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="نام کالا، برند یا کد فنی" /></label></div><div className="admin-product-grid">{filteredProducts.map(product => <div key={product.id}><div className={`admin-product-image bg-${product.color}`}><ProductImage product={product} /></div><p><small>{product.brand} · {product.category}</small><strong>{product.name}</strong><span>{formatPrice(product.price)} تومان · موجودی: {formatPrice(product.stock)}</span><span className="admin-sku" dir="ltr">{product.sku}</span></p><button aria-label={`ویرایش ${product.name}`} title="ویرایش کالا" onClick={() => openProduct(product)}><Icon name="edit" size={18} /></button></div>)}</div>{!filteredProducts.length && <p className="admin-empty">کالایی با این نام یا کد پیدا نشد.</p>}</section>}

        {active === 'دسته‌بندی‌ها' && <section className="orders-panel"><div className="panel-heading"><div><h2>دسته‌بندی کالاها</h2><span>شمار کالاهای هر دسته از اطلاعات فروشگاه محاسبه می‌شود.</span></div><button onClick={() => { setCategoryModal(true); setWriteError('') }}><Icon name="plus" size={18} /> دسته تازه</button></div><div className="admin-category-grid">{categories.map(category => <article key={category.id}><span className="category-symbol"><Icon name={categoryIcon(category.icon)} size={27} /></span><div><h3>{category.title}</h3><p>{formatPrice(category.count)} کالا</p></div><button onClick={() => { setProductSearch(category.title); setActive('محصولات') }} aria-label={`کالاهای ${category.title}`}>مشاهده</button></article>)}</div>{!categories.length && <p className="admin-empty">نخستین دسته کالا را بسازید.</p>}</section>}

        {active === 'گزارش فروش' && <section className="orders-panel">
          <div className="panel-heading"><div><h2>گزارش فروش، کل دوره</h2><span>گزارش از همه سفارش‌های پایگاه داده محاسبه می‌شود و به صفحه سفارش‌ها محدود نیست.</span></div></div>
          <div className="admin-report-summary"><div><span>مبلغ سفارش‌های پرداخت‌شده</span><strong>{formatPrice(report.revenue)} تومان</strong></div><div><span>سفارش پرداخت‌شده</span><strong>{formatPrice(report.count)} سفارش</strong></div><div><span>میانگین مبلغ سفارش پرداخت‌شده</span><strong>{formatPrice(report.average)} تومان</strong></div><div><span>کل سفارش‌های ثبت‌شده</span><strong>{formatPrice(overview.metrics.orders)} سفارش</strong></div></div>
          <div className="admin-report-status">{Object.entries(statusLabels).map(([status, label]) => <div key={status}><span className={`status status-${status}`}>{label}</span><strong>{formatPrice(overview.reports.byStatus.find(row => row.status === status)?.count || 0)} سفارش</strong></div>)}</div>
          <div className="admin-daily-report"><h3>فروش روزانه، ۳۰ روز اخیر</h3><p className="admin-hint">روزها بر اساس زمان تهران هستند. تعداد، همه سفارش‌های روز است؛ مبلغ فقط سفارش‌های پرداخت‌شده و مراحل پس از آن را دربرمی‌گیرد.</p>{overview.reports.byDay.length ? <table><thead><tr><th scope="col">روز ثبت</th><th scope="col">شمار سفارش</th><th scope="col">مبلغ پرداخت‌شده (تومان)</th></tr></thead><tbody>{[...overview.reports.byDay].reverse().map(row => <tr key={row.date}><th scope="row">{reportDayLabel(row.date)}</th><td>{formatPrice(row.count)}</td><td>{formatPrice(row.total)}</td></tr>)}</tbody></table> : <p className="admin-empty">در ۳۰ روز اخیر سفارشی ثبت نشده است.</p>}</div>
          <p className="admin-hint admin-report-note">مبالغ شامل هزینه ارسال هستند؛ سود خالص نیستند. سفارش‌های پرداخت‌نشده و لغوشده در مبلغ فروش محاسبه نمی‌شوند. خبرنامه: {formatPrice(overview.metrics.subscribers)} شماره ثبت‌شده با رضایت کاربر.</p>
        </section>}

        {active === 'راه‌اندازی فروشگاه' && <section className="orders-panel"><div className="panel-heading"><div><h2>وضعیت راه‌اندازی</h2><span>تنظیمات تجاری پس از مشخص شدن اطلاعات فروشگاه تکمیل می‌شوند.</span></div></div><div className="admin-setup"><article><Icon name="shield" /><div><h3>درگاه پرداخت</h3><p>در انتظار انتخاب و تنظیم درگاه. دریافت وجه در این نسخه خودکار نیست؛ وضعیت پرداخت فقط با بررسی مدیر ثبت می‌شود.</p></div></article><article><Icon name="truck" /><div><h3>روش ارسال و تعرفه</h3><p>در انتظار تعیین شرکت حمل، محدوده خدمت و تعرفه نهایی. هزینه‌های فعلی برای آزمودن محاسبه سفارش هستند.</p></div></article><article><Icon name="user" /><div><h3>راه‌های تماس</h3><p>شماره پشتیبانی، نشانی و ساعت پاسخ‌گویی پس از تأیید مالک فروشگاه درج می‌شوند.</p></div></article></div></section>}
      </>}
    </div>

    {productModal && <Modal title={productModal.product ? 'ویرایش کالا' : 'افزودن کالای تازه'} onClose={closeProduct}><ProductForm product={productModal.product} categories={categories} busy={busy} error={writeError} onSave={saveProduct} onClose={closeProduct} /></Modal>}
    {categoryModal && <Modal title="ساخت دسته کالا" onClose={closeCategory}><CategoryForm busy={busy} error={writeError} onClose={closeCategory} onSave={(title, icon) => void mutate(() => api('/admin/categories', {method: 'POST', body: json({title, icon})}), 'دسته تازه ساخته شد.', () => setCategoryModal(false), true)} /></Modal>}
    {selectedOrder && <Modal title="جزئیات سفارش" onClose={closeOrder}>
      <div className="admin-order-detail"><div className="admin-order-heading"><strong dir="ltr">{selectedOrder.id}</strong><span className={`status status-${selectedOrder.status}`}>{statusLabels[selectedOrder.status]}</span></div><p className="admin-hint">ثبت‌شده در {dateLabel(selectedOrder.createdAt)}</p>
        <dl className="admin-customer"><div><dt>نام مشتری</dt><dd>{selectedOrder.customer.name}</dd></div><div><dt>شماره موبایل</dt><dd dir="ltr">{selectedOrder.customer.phone}</dd></div><div><dt>ایمیل</dt><dd dir="ltr">{selectedOrder.customer.email || 'ثبت نشده'}</dd></div><div><dt>کد پستی</dt><dd dir="ltr">{selectedOrder.customer.postalCode}</dd></div><div className="admin-address"><dt>نشانی تحویل</dt><dd>{selectedOrder.customer.address}</dd></div></dl>
        <ul className="admin-order-items">{selectedOrder.items.map(item => <li key={item.productId}><div><strong>{item.name}</strong><span>{formatPrice(item.quantity)} عدد × {formatPrice(item.price)} تومان</span></div><b>{formatPrice(item.lineTotal)} تومان</b></li>)}</ul>
        <dl className="admin-order-totals"><div><dt>جمع کالاها</dt><dd>{formatPrice(selectedOrder.subtotal)} تومان</dd></div><div><dt>هزینه ارسال ثبت‌شده</dt><dd>{formatPrice(selectedOrder.shipping)} تومان</dd></div><div><dt>مبلغ سفارش</dt><dd><strong>{formatPrice(selectedOrder.total)} تومان</strong></dd></div></dl>
        {selectedOrder.status === 'pending_payment' && <label className="admin-payment-check"><input type="checkbox" checked={paymentChecked} onChange={e => setPaymentChecked(e.target.checked)} disabled={busy} /><span>دریافت وجه این سفارش را بررسی کرده‌ام. این تأیید دستی است و تراکنش درگاه ایجاد نمی‌کند.</span></label>}
        {writeError && <p className="admin-form-error" role="alert">{writeError}</p>}
        <div className="modal-actions admin-order-actions">{selectedOrder.status === 'pending_payment' && <button type="button" className="admin-cancel" disabled={busy} onClick={() => changeStatus(selectedOrder, 'cancelled')}>لغو سفارش و بازگرداندن موجودی</button>}{nextStatus[selectedOrder.status] && <ActionButton type="button" pending={busy} disabled={selectedOrder.status === 'pending_payment' && !paymentChecked} onClick={() => changeStatus(selectedOrder, nextStatus[selectedOrder.status])}>{actionLabels[nextStatus[selectedOrder.status]]}<Icon name="check" size={18}/></ActionButton>}</div>
      </div>
    </Modal>}
  </div>
}
