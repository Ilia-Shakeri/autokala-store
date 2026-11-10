import { digits } from './api'

export function phoneIssue(value: string): string {
  const phone = digits(value.trim()).replace(/[\s()-]/g, '').replace(/^(?:\+98|0098)/, '0')
  return /^09\d{9}$/.test(phone) ? '' : 'شماره همراه ایران درست نیست.'
}

export function postalIssue(value: string): string {
  const postal = digits(value.trim())
  return /^\d{10}$/.test(postal) && !/^(\d)\1{9}$/.test(postal) ? '' : 'کد پستی ده رقمی درست نیست.'
}
