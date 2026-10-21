export function LoadingCar({ label = 'در حال دریافت…', inline = false, iconOnly = false }: {label?: string; inline?: boolean; iconOnly?: boolean}) {
  return <span className={`car-loading${inline ? ' car-loading--inline' : ''}${iconOnly ? ' car-loading--icon' : ''}`} role="status" aria-live="polite">
    <svg className="car-loading-scene" viewBox="0 0 120 44" fill="none" aria-hidden="true" focusable="false">
      <g className="car-loading-road"><path d="M-20 39H140" stroke="currentColor" strokeWidth="2" strokeDasharray="10 10"/></g>
      <g className="car-loading-body" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25 30V23l8-3 9-11h31l12 12 10 3v9h-9M43 33h25M25 33h1" fill="var(--acid)"/>
        <path d="m38 20 7-8h12v8H38Zm24-8h9l9 8H62v-8ZM21 20H9m10 7H3m17 7h-9M89 26h6M48 24h5"/>
        <g className="car-loading-wheel"><circle cx="35" cy="32" r="8" fill="var(--paper)"/><path d="M35 27v10m-5-5h10"/></g>
        <g className="car-loading-wheel"><circle cx="77" cy="32" r="8" fill="var(--paper)"/><path d="M77 27v10m-5-5h10"/></g>
      </g>
    </svg>
    <span className="car-loading-label">{label}</span>
  </span>
}
