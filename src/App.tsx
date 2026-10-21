import { useMemo, useState } from 'react'

type IconName =
  | 'arrow'
  | 'bag'
  | 'box'
  | 'cart'
  | 'chart'
  | 'check'
  | 'chevron'
  | 'dashboard'
  | 'edit'
  | 'filter'
  | 'grid'
  | 'heart'
  | 'menu'
  | 'minus'
  | 'orders'
  | 'plus'
  | 'search'
  | 'shield'
  | 'spark'
  | 'store'
  | 'truck'
  | 'user'
  | 'x'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    bag: <><path d="M6 8h12l1 13H5L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 7v10l8 4 8-4V7M12 11v10" /></>,
    cart: <><path d="M3 4h2l2 12h10l3-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    edit: <><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    minus: <path d="M5 12h14" />,
    orders: <><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    spark: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></>,
    store: <><path d="M4 10v11h16V10M3 4h18l-1 6a3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-4 0L3 4Z" /></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

const products = [
  { id: 1, name: 'روغن موتور SN 10W-40', brand: 'بهران', price: 765000, oldPrice: 850000, category: 'روغن و سیالات', label: '۱۰٪', visual: 'oil', color: 'amber' },
  { id: 2, name: 'فیلتر هوای موتور', brand: 'سرکان', price: 245000, category: 'فیلترها', label: 'پرفروش', visual: 'filter', color: 'cream' },
  { id: 3, name: 'لنت ترمز جلو مدل Pro', brand: 'ام‌کو', price: 1280000, oldPrice: 1460000, category: 'ترمز', label: 'ویژه', visual: 'brake', color: 'red' },
  { id: 4, name: 'ضدیخ و ضدجوش چهار فصل', brand: 'کاسپین', price: 310000, category: 'روغن و سیالات', label: 'جدید', visual: 'coolant', color: 'blue' },
]

const categories = [
  { title: 'روغن و سیالات', count: '۸۴ کالا', icon: 'oil' },
  { title: 'فیلترها', count: '۵۱ کالا', icon: 'filter' },
  { title: 'لنت و ترمز', count: '۳۶ کالا', icon: 'brake' },
  { title: 'شمع و برق', count: '۴۲ کالا', icon: 'spark' },
  { title: 'برف‌پاک‌کن', count: '۲۹ کالا', icon: 'wiper' },
  { title: 'نظافت خودرو', count: '۶۷ کالا', icon: 'spray' },
]

const ordersSeed = [
  { id: '#س‌ف-۲۹۴۱', customer: 'علی رضایی', amount: '۱٬۳۴۰٬۰۰۰', date: 'امروز، ۱۰:۴۵', status: 'در انتظار تایید' },
  { id: '#س‌ف-۲۹۴۰', customer: 'مریم محمدی', amount: '۲٬۷۶۵٬۰۰۰', date: 'امروز، ۰۹:۱۲', status: 'در حال ارسال' },
  { id: '#س‌ف-۲۹۳۹', customer: 'سینا اکبری', amount: '۸۹۰٬۰۰۰', date: 'دیروز، ۱۸:۳۵', status: 'تکمیل شده' },
  { id: '#س‌ف-۲۹۳۸', customer: 'نازنین مرادی', amount: '۴٬۱۲۰٬۰۰۰', date: 'دیروز، ۱۵:۰۲', status: 'در انتظار تایید' },
]

function formatPrice(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value)
}

function ProductVisual({ type }: { type: string }) {
  return (
    <div className={`product-visual product-${type}`}>
      {type === 'oil' && <><span className="bottle-cap" /><span className="bottle-body">SAE<br /><b>10W-40</b></span></>}
      {type === 'filter' && <><span className="filter-top" /><span className="filter-body" /><span className="filter-lines" /></>}
      {type === 'brake' && <><span className="brake-disc" /><span className="brake-pad" /></>}
      {type === 'coolant' && <><span className="coolant-handle" /><span className="coolant-body">۴ فصل</span></>}
    </div>
  )
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <button className={`logo ${light ? 'logo-light' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="اتوکالا">
      <span className="logo-mark"><span /></span>
      <span className="logo-text"><strong>اتوکالا</strong><small>AUTOKALA</small></span>
    </button>
  )
}

function Storefront({ onAdmin }: { onAdmin: () => void }) {
  const [activeCategory, setActiveCategory] = useState('همه')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<number[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [favorites, setFavorites] = useState<number[]>([])
  const [toast, setToast] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleProducts = useMemo(() => products.filter((product) =>
    (activeCategory === 'همه' || product.category.includes(activeCategory)) &&
    product.name.includes(query)
  ), [activeCategory, query])

  const addToCart = (id: number) => {
    setCart((current) => [...current, id])
    setToast('محصول به سبد خرید اضافه شد')
    window.setTimeout(() => setToast(''), 2200)
  }

  return (
    <div className="storefront" dir="rtl">
      <div className="announcement">
        <span><Icon name="truck" size={17} /> ارسال رایگان برای خریدهای بالای ۲ میلیون تومان</span>
        <span className="announcement-left">مشاوره خرید: ۰۲۱-۹۱۰۰ ۴۲۱۰</span>
      </div>
      <header className="main-header">
        <div className="nav-shell">
          <Logo />
          <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
            <button onClick={() => setMenuOpen(false)}>فروشگاه</button>
            <button onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}>دسته‌بندی‌ها</button>
            <button>پیشنهاد ویژه</button>
            <button>مجله خودرو</button>
          </nav>
          <div className="nav-actions">
            <button className="icon-btn admin-shortcut" onClick={onAdmin} title="پنل مدیریت"><Icon name="grid" /></button>
            <button className="icon-btn"><Icon name="user" /></button>
            <button className="cart-button" onClick={() => setCartOpen(true)}>
              <Icon name="bag" />
              <span className="cart-copy">سبد خرید<small>{cart.length ? `${cart.length.toLocaleString('fa-IR')} کالا` : 'خالی'}</small></span>
              {cart.length > 0 && <b>{cart.length.toLocaleString('fa-IR')}</b>}
            </button>
            <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'x' : 'menu'} /></button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-photo" aria-hidden="true" />
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="eyebrow"><Icon name="spark" size={16} /> قطعه درست، خیال راحت</div>
            <h1>حال خوبِ خودرو<br /><em>از همین‌جا شروع می‌شه.</em></h1>
            <p>لوازم مصرفی اصل، انتخاب دقیق برای خودروی شما و ارسال سریع به سراسر ایران.</p>
            <div className="vehicle-finder">
              <div className="finder-title"><span><Icon name="search" /> قطعه مناسب خودروی من</span><small>سه مرحله تا انتخاب مطمئن</small></div>
              <div className="finder-controls">
                <button>برند خودرو <Icon name="chevron" size={17} /></button>
                <button>مدل خودرو <Icon name="chevron" size={17} /></button>
                <button>سال ساخت <Icon name="chevron" size={17} /></button>
                <button className="finder-submit">نمایش قطعات <Icon name="arrow" size={18} /></button>
              </div>
            </div>
          </div>
          <div className="hero-stat">
            <strong>+۱۲٬۰۰۰</strong>
            <span>مشتری راضی در سراسر ایران</span>
            <div className="avatars"><i /><i /><i /><i /><b>۴.۹</b></div>
          </div>
          <div className="scroll-hint"><span /> بیشتر ببینید</div>
        </section>

        <section className="trust-strip">
          <div><span><Icon name="shield" /></span><p><strong>ضمانت اصالت</strong><small>تضمین ۱۰۰٪ کالای اصل</small></p></div>
          <div><span><Icon name="truck" /></span><p><strong>ارسال سریع</strong><small>تحویل اکسپرس در تهران</small></p></div>
          <div><span><Icon name="store" /></span><p><strong>۷ روز ضمانت بازگشت</strong><small>خرید بدون دغدغه</small></p></div>
          <div><span><Icon name="user" /></span><p><strong>مشاوره تخصصی</strong><small>انتخاب دقیق قطعه</small></p></div>
        </section>

        <section className="section categories-section" id="categories">
          <div className="section-heading">
            <div><span>دسته‌بندی محصولات</span><h2>هر چیزی که خودرو نیاز داره</h2></div>
            <button className="text-link">مشاهده همه <Icon name="arrow" size={18} /></button>
          </div>
          <div className="category-grid">
            {categories.map((category, index) => (
              <button className="category-card reveal" style={{ animationDelay: `${index * 70}ms` }} key={category.title} onClick={() => setActiveCategory(category.title.split(' ')[0])}>
                <span className={`category-symbol symbol-${category.icon}`}><Icon name={category.icon === 'spark' ? 'spark' : category.icon === 'brake' ? 'chart' : 'box'} size={32} /></span>
                <span><strong>{category.title}</strong><small>{category.count}</small></span>
                <Icon name="arrow" size={18} />
              </button>
            ))}
          </div>
        </section>

        <section className="products-section">
          <div className="section products-inner">
            <div className="section-heading">
              <div><span>انتخاب‌های مطمئن</span><h2>پرفروش‌های این هفته</h2></div>
              <div className="product-tools">
                <label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی محصول..." /></label>
                <button className="text-link">همه محصولات <Icon name="arrow" size={18} /></button>
              </div>
            </div>
            <div className="filter-pills">
              {['همه', 'روغن', 'فیلترها', 'ترمز'].map((item) => <button className={activeCategory === item ? 'active' : ''} onClick={() => setActiveCategory(item)} key={item}>{item}</button>)}
            </div>
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className={`product-image bg-${product.color}`}>
                    <span className="product-label">{product.label}</span>
                    <button className={favorites.includes(product.id) ? 'heart active' : 'heart'} onClick={() => setFavorites((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])}><Icon name="heart" size={19} /></button>
                    <ProductVisual type={product.visual} />
                  </div>
                  <div className="product-info">
                    <small>{product.brand}</small>
                    <h3>{product.name}</h3>
                    <div className="price-row">
                      <p>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}<strong>{formatPrice(product.price)} <small>تومان</small></strong></p>
                      <button onClick={() => addToCart(product.id)} aria-label="افزودن به سبد"><Icon name="plus" /></button>
                    </div>
                  </div>
                </article>
              ))}
              {!visibleProducts.length && <div className="empty-products">محصولی با این مشخصات پیدا نشد.</div>}
            </div>
          </div>
        </section>

        <section className="section promo">
          <div>
            <span>پیشنهاد محدود این هفته</span>
            <h2>خودروت رو برای سفر<br />آماده کن.</h2>
            <p>تا ۲۵٪ تخفیف روی پک‌های سرویس دوره‌ای</p>
            <button>مشاهده پک‌ها <Icon name="arrow" size={18} /></button>
          </div>
          <div className="promo-rings"><i /><i /><span><Icon name="spark" size={52} /></span></div>
        </section>
      </main>

      <footer>
        <div className="footer-main section">
          <div className="footer-brand"><Logo light /><p>مرجع تخصصی لوازم مصرفی خودرو؛<br />ساده، مطمئن و همیشه در دسترس.</p></div>
          <div><strong>اتوکالا</strong><button>درباره ما</button><button>تماس با ما</button><button>فرصت‌های شغلی</button></div>
          <div><strong>راهنمای خرید</strong><button>روش‌های پرداخت</button><button>ارسال سفارش</button><button>شرایط بازگشت</button></div>
          <div className="newsletter"><strong>از تخفیف‌ها جا نمون!</strong><p>شماره موبایلت رو وارد کن</p><label><input placeholder="۰۹۱۲ ۱۲۳ ۴۵۶۷" /><button><Icon name="arrow" /></button></label></div>
        </div>
        <div className="footer-bottom section"><span>© ۱۴۰۳ اتوکالا؛ تمامی حقوق محفوظ است.</span><button onClick={onAdmin}>ورود به پنل مدیریت</button></div>
      </footer>

      {cartOpen && <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
        <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-head"><h2>سبد خرید</h2><button onClick={() => setCartOpen(false)}><Icon name="x" /></button></div>
          {cart.length === 0 ? <div className="cart-empty"><Icon name="bag" size={42} /><strong>سبد خریدت خالیه</strong><span>محصولات مورد نیاز خودروت رو اضافه کن.</span></div> :
            <><div className="cart-list">{cart.map((id, index) => {
              const item = products.find((product) => product.id === id)!
              return <div key={`${id}-${index}`}><ProductVisual type={item.visual} /><p><strong>{item.name}</strong><span>{formatPrice(item.price)} تومان</span></p><button onClick={() => setCart((current) => current.filter((_, i) => i !== index))}><Icon name="x" size={17} /></button></div>
            })}</div><div className="cart-total"><span>مبلغ قابل پرداخت</span><strong>{formatPrice(cart.reduce((sum, id) => sum + products.find((product) => product.id === id)!.price, 0))} تومان</strong><button>ادامه فرایند خرید <Icon name="arrow" /></button></div></>}
        </aside>
      </div>}
      {toast && <div className="toast"><span><Icon name="check" /></span>{toast}</div>}
    </div>
  )
}

function AdminPanel({ onStore }: { onStore: () => void }) {
  const [active, setActive] = useState('داشبورد')
  const [orders, setOrders] = useState(ordersSeed)
  const [productModal, setProductModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const confirmOrder = (id: string) => setOrders((current) => current.map((order) => order.id === id ? { ...order, status: 'در حال ارسال' } : order))

  return (
    <div className="admin" dir="rtl">
      <aside className={sidebarOpen ? 'admin-sidebar open' : 'admin-sidebar'}>
        <div className="sidebar-logo"><Logo light /><button onClick={() => setSidebarOpen(false)}><Icon name="x" /></button></div>
        <div className="admin-profile"><span>م‌ن</span><p><strong>مدیر فروشگاه</strong><small>admin@autokala.ir</small></p></div>
        <nav>
          {[
            ['داشبورد', 'dashboard'], ['سفارش‌ها', 'orders'], ['محصولات', 'box'], ['دسته‌بندی‌ها', 'grid'], ['گزارش فروش', 'chart']
          ].map(([title, icon]) => <button className={active === title ? 'active' : ''} key={title} onClick={() => { setActive(title); setSidebarOpen(false) }}><Icon name={icon as IconName} />{title}{title === 'سفارش‌ها' && <b>۲</b>}</button>)}
        </nav>
        <button className="go-store" onClick={onStore}><Icon name="store" /> مشاهده فروشگاه</button>
      </aside>
      <div className="admin-content">
        <header className="admin-header">
          <button className="admin-menu" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <div><span>امروز، دوشنبه ۲۴ اردیبهشت</span><h1>{active}</h1></div>
          <div className="admin-header-actions"><button><Icon name="search" /></button><button className="notification"><Icon name="spark" /><i /></button><button className="new-product" onClick={() => setProductModal(true)}><Icon name="plus" /> افزودن محصول</button></div>
        </header>

        {active === 'داشبورد' && <>
          <section className="welcome-card">
            <div><span>گزارش امروز</span><h2>سلام، روز پرفروشی داشته باشی!</h2><p>فروش امروز نسبت به دیروز <strong>۱۸٪ بیشتر</strong> بوده.</p></div>
            <div className="mini-chart"><i /><i /><i /><i /><i /><i /><i /><span>+۱۸٪</span></div>
          </section>
          <section className="metric-grid">
            <div><span className="metric-icon green"><Icon name="chart" /></span><p><small>فروش امروز</small><strong>۱۸٬۴۵۰٬۰۰۰ <em>تومان</em></strong><b>↑ ۱۸٪</b></p></div>
            <div><span className="metric-icon yellow"><Icon name="orders" /></span><p><small>سفارش جدید</small><strong>۲۴ <em>سفارش</em></strong><b>↑ ۶ سفارش</b></p></div>
            <div><span className="metric-icon blue"><Icon name="box" /></span><p><small>موجودی کم</small><strong>۸ <em>محصول</em></strong><b className="warning">نیاز به بررسی</b></p></div>
            <div><span className="metric-icon purple"><Icon name="user" /></span><p><small>مشتری جدید</small><strong>۱۷ <em>نفر</em></strong><b>↑ ۱۲٪</b></p></div>
          </section>
        </>}

        {(active === 'داشبورد' || active === 'سفارش‌ها') && <section className="orders-panel">
          <div className="panel-heading"><div><h2>{active === 'داشبورد' ? 'سفارش‌های اخیر' : 'مدیریت سفارش‌ها'}</h2><span>بررسی و تایید سفارش‌های ثبت‌شده</span></div><button><Icon name="filter" size={18} /> فیلتر</button></div>
          <div className="order-table">
            <div className="table-row table-head"><span>شماره سفارش</span><span>مشتری</span><span>مبلغ (تومان)</span><span>زمان ثبت</span><span>وضعیت</span><span /></div>
            {orders.map((order) => <div className="table-row" key={order.id}>
              <strong>{order.id}</strong><span className="customer"><i>{order.customer.charAt(0)}</i>{order.customer}</span><b>{order.amount}</b><span>{order.date}</span>
              <span><i className={`status status-${order.status.replaceAll(' ', '-')}`}>{order.status}</i></span>
              <span>{order.status === 'در انتظار تایید' ? <button className="confirm-btn" onClick={() => confirmOrder(order.id)}><Icon name="check" size={16} /> تایید</button> : <button className="more-btn">•••</button>}</span>
            </div>)}
          </div>
        </section>}

        {active === 'محصولات' && <section className="orders-panel products-admin">
          <div className="panel-heading"><div><h2>محصولات فروشگاه</h2><span>۴ محصول فعال در فروشگاه</span></div><button onClick={() => setProductModal(true)}><Icon name="plus" size={18} /> محصول جدید</button></div>
          <div className="admin-product-grid">{products.map((product) => <div key={product.id}><div className={`admin-product-image bg-${product.color}`}><ProductVisual type={product.visual} /></div><p><small>{product.brand}</small><strong>{product.name}</strong><span>{formatPrice(product.price)} تومان</span></p><button><Icon name="edit" size={18} /></button></div>)}</div>
        </section>}

        {!['داشبورد', 'سفارش‌ها', 'محصولات'].includes(active) && <section className="empty-admin"><Icon name={active === 'گزارش فروش' ? 'chart' : 'grid'} size={48} /><h2>{active}</h2><p>این بخش آماده اتصال به داده‌های بک‌اند است.</p></section>}
      </div>

      {productModal && <div className="modal-backdrop" onClick={() => setProductModal(false)}><div className="product-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><div><h2>افزودن محصول جدید</h2><span>اطلاعات کالا را کامل وارد کنید</span></div><button onClick={() => setProductModal(false)}><Icon name="x" /></button></div>
        <div className="form-grid"><label>نام محصول<input placeholder="مثلاً روغن موتور 10W-40" /></label><label>برند<input placeholder="نام برند" /></label><label>قیمت (تومان)<input placeholder="۰" /></label><label>موجودی<input placeholder="۰" /></label><label>دسته‌بندی<select defaultValue=""><option value="" disabled>انتخاب دسته‌بندی</option><option>روغن و سیالات</option><option>فیلترها</option><option>ترمز</option></select></label><label>کد محصول<input placeholder="AK-0001" /></label></div>
        <label className="description-field">توضیحات محصول<textarea placeholder="توضیحات کوتاه محصول..." /></label>
        <div className="modal-actions"><button onClick={() => setProductModal(false)}>انصراف</button><button onClick={() => setProductModal(false)}>ذخیره محصول <Icon name="check" size={18} /></button></div>
      </div></div>}
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<'store' | 'admin'>('store')
  return view === 'store' ? <Storefront onAdmin={() => setView('admin')} /> : <AdminPanel onStore={() => setView('store')} />
}
