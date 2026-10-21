export type IconName =
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
  | 'car'
  | 'oil'
  | 'air-filter'
  | 'brake'
  | 'spark-plug'
  | 'wiper'
  | 'spray'
  | 'refresh'

export function categoryIcon(name: string): IconName {
  const icons: Record<string, IconName> = {oil:'oil', filter:'air-filter', brake:'brake', spark:'spark-plug', wiper:'wiper', spray:'spray', coolant:'oil'}
  return icons[name] || 'box'
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
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
    car: <><path d="m5 10 2-5h10l2 5M3 11l2-1h14l2 1v7H3v-7ZM5 18v2m14-2v2M7 14h2m6 0h2"/><path d="M7 10h10"/></>,
    oil: <><path d="M5 7h9l5 5v9H5V7ZM7 3h6v4M14 7V4l6 4-2 3"/><path d="M12 12s-3 3-3 5a3 3 0 0 0 6 0c0-2-3-5-3-5Z"/></>,
    'air-filter': <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 8v8m3-8v8m3-8v8m3-8v8m3-8v8"/></>,
    brake: <><circle cx="10" cy="12" r="8"/><circle cx="10" cy="12" r="2"/><path d="M10 7v.1M5 12h.1M10 17v.1M16 5h4l2 3v8l-2 3h-4V5Z"/></>,
    'spark-plug': <><path d="M10 2h4v5h-4zM9 7h6v7H9zM7 14h10v3H7zM9 17h6v4H9zM12 21v1M9 10h6M9 12h6"/></>,
    wiper: <><path d="m3 16 2-9a16 16 0 0 1 14 0l2 9H3ZM12 18l6-9M10 17 5 11M5 8l3 4M16 9l3 2"/><circle cx="12" cy="19" r="2"/></>,
    spray: <><path d="M8 3h11v3h-6l-2 5H7l1-8ZM13 6l4 4M7 11h5l3 5v5H4v-5l3-5ZM19 12h2m-3 4h3M7 16h5"/></>,
    refresh: <><path d="M20 10a8 8 0 0 0-14-4L3 9m0-5v5h5M4 14a8 8 0 0 0 14 4l3-3m0 5v-5h-5"/></>,
  }
  return <svg {...common} className={`site-icon icon-${name}`} data-icon={name} focusable="false">{paths[name]}</svg>
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value)
}

export function ProductVisual({ type }: { type: string }) {
  return (
    <div className={`product-visual product-${type}`}>
      {type === 'oil' && <><span className="bottle-cap" /><span className="bottle-body">SAE<br /><b>10W-40</b></span></>}
      {type === 'filter' && <><span className="filter-top" /><span className="filter-body" /><span className="filter-lines" /></>}
      {type === 'brake' && <><span className="brake-disc" /><span className="brake-pad" /></>}
      {type === 'coolant' && <><span className="coolant-handle" /><span className="coolant-body">۴ فصل</span></>}
      {type === 'spark' && <><span className="spark-tip"/><span className="spark-body"/><span className="spark-base"/></>}
      {type === 'wiper' && <><span className="wiper-blade"/><span className="wiper-blade second"/></>}
      {type === 'spray' && <><span className="spray-head"/><span className="spray-neck"/><span className="spray-body">AUTO<br/>CARE</span></>}
    </div>
  )
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <button className={`logo ${light ? 'logo-light' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="اتوکالا">
      <span className="logo-mark"><span /></span>
      <span className="logo-text"><strong>اتوکالا</strong><small>AUTOKALA</small></span>
    </button>
  )
}

