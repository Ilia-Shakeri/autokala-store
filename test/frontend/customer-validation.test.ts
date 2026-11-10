import { expect,it } from 'vitest'
import { phoneIssue,postalIssue } from '../../src/customer-validation'

it('accepts local and international Iranian mobile formats in Persian and Arabic digits',()=>{
  for(const phone of ['۰۹۱۲۳۴۵۶۷۸۹','٠٩١٢٣٤٥٦٧٨٩','+98 (912) 345-6789','00989123456789'])expect(phoneIssue(phone)).toBe('')
  for(const phone of ['09123','+12025550123','02112345678'])expect(phoneIssue(phone)).toBeTruthy()
})
it('accepts ten postal digits and rejects repeated or non-digit postal codes',()=>{
  expect(postalIssue('۱۲۳۴۵۶۷۸۹۰')).toBe('')
  expect(postalIssue('١٢٣٤٥٦٧٨٩٠')).toBe('')
  for(const postal of ['0000000000','۱۲۳۴۵','12345abcde'])expect(postalIssue(postal)).toBeTruthy()
})
