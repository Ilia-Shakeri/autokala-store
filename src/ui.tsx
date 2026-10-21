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
  }
  return <svg {...common}>{paths[name]}</svg>
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

