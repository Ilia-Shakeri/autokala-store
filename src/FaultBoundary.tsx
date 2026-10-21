import { Component, type ErrorInfo, type ReactNode } from 'react'

export default class FaultBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false}
  static getDerivedStateFromError() { return {failed: true} }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Keep account and order data out of diagnostic output. */ }
  render() {
    if (this.state.failed) return <main className="boot-state" dir="rtl"><h1>باز کردن فروشگاه کامل نشد</h1><p>صفحه را دوباره باز کنید. سبد ذخیره‌شده روی همین دستگاه می‌ماند.</p><button onClick={()=>window.location.reload()}>بارگذاری دوباره</button></main>
    return this.props.children
  }
}
