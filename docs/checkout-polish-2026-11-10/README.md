# Checkout polish — 2026-11-10

- [Layout]: Cart palette kept. Desktop two columns; phone one column. Recipient and delivery groups, optional note disclosure, quote item photos, quantities, unit prices and line totals added. Footer holds total and submit outside the scroll area.
- [Truth]: Amounts and item names come from the server quote. Catalog supplies illustrative images only. Demo, pending payment, shipping setup and 24-hour reservation notices kept.
- [Motion]: Occasional entrance and receipt feedback use opacity/transform, 250 ms; exit 180 ms; note and quote reveal 200/220 ms. Existing ease-out and number motion reused. Keyboard and reduced-motion paths skip movement. No new dependency.
- [Recovery]: Frozen request, owner check, exact retry key and submitted-item subtraction kept. Closing disables submission until exit completes. Errors receive focus; receipt starts at top with status focus.
- [Tests]: Build and typecheck passed. Backend 46/46; frontend 85/85 in 14 files. Added quote/note and focus checks, plus exit lifetime, cleanup, busy, keyboard and reduced-motion checks. Existing recovery integration now waits for the enabled submit control.
- [Browser]: Local in-memory API, synthetic customer. Completed one unpaid sample order, inspected receipt, closed it, reopened checkout. Tested 1440x1000, 390x844, 320x568 and 320x360. At 320 the form client/scroll widths both 305px. At 320x360 submit bounds y308–352; 44px high. Inputs 16px/50px. Receipt has no horizontal overflow; status focused and scrollTop 0.
- [Evidence]: desktop.png and phone.png show final form. phone-summary.png, phone-320.png and short-phone.png show summary/footer stress checks. Images show local sample data only.
- [Correction]: Initial 8/10: errors could sit below a long summary; focused error panel added. Duplicate total labels made an old test ambiguous; replaced with an enabled-submit wait. Receipt text and close target enlarged. Final scoped quality 9/10 after checks.
- [Limits]: Browser viewport tests are desktop Chromium checks. Physical iPhone/Android, full screen-reader validation, real payments and deployed commerce were not tested here.
