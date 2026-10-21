# قرارداد سرور

- [ریشه]: `/api`. JSON با UTF-8. پول عدد صحیح تومان. زمان، ISO در UTC. شناسه کالا عدد؛ شناسه سفارش رشته تصادفی.
- [خطا]: پاسخ JSON با `error`. داده بد ۴۰۰، ورود لازم ۴۰۱، نقش یا مبدأ غلط ۴۰۳، نبود داده ۴۰۴، تداخل موجودی یا وضعیت ۴۰۹، بدنه بزرگ ۴۱۳، نوع بدنه غلط ۴۱۵، تلاش زیاد ۴۲۹. خطای داخلی ۵۰۰ پیام کلی دهد.
- [نشست]: ورود با کوکی `autokala_session`، `HttpOnly` و `SameSite=Lax`، عمر ۱۴ روز. زیر HTTPS با تنظیم میزبان، `Secure`. مرورگر درخواست هم‌مبدأ فرستد. سرور نقش را از پایگاه بخواند. نقش دریافتی از مشتری سند نیست.
- [مبدأ]: درخواست تغییردهنده با Origin ناسازگار رد شود. دامنه اجرای واقعی در تنظیم سرور قرار گیرد.
- [درگاه]: اتصال واقعی هنوز تعیین نشده. API هرگز پرداخت ساختگی موفق نسازد.

## مسیرها

| روش | مسیر | ورودی و خروجی |
| --- | --- | --- |
| GET | `/health/live` | `{live:true}` |
| GET | `/health/ready` | `{ready:true,staticBuilt:boolean}` |
| GET | `/api/catalog` | `{products,categories,vehicles,settings}`؛ با ETag |
| GET | `/api/session` | `{user:null}` یا کاربر عمومی |
| POST | `/api/auth/register` | `{name,email,password}`؛ پاسخ ۲۰۱، `{user}` و کوکی |
| POST | `/api/auth/login` | `{email,password}`؛ پاسخ `{user}` و کوکی |
| POST | `/api/auth/logout` | `{}`؛ پاسخ `{ok:true}` و بستن نشست |
| POST | `/api/quote` | `{items:[{productId,quantity}]}`؛ پاسخ `{items,subtotal,shipping,total}` |
| POST | `/api/orders` | `{items,customer,note?,idempotencyKey}`؛ پاسخ ۲۰۱، `{order,receiptToken}` |
| GET | `/api/orders?offset=0&limit=200` | حساب لازم؛ `{orders,pagination}`، سفارش همان حساب |
| GET | `/api/orders/:id` | `{order}`؛ توکن مهمان در هدر `X-Receipt-Token` |
| POST | `/api/subscribe` | `{phone,consent:true}`؛ پاسخ ۲۰۱، `{ok:true,message}`؛ ارسال پیام وصل نیست |
| GET | `/api/admin/overview?offset=0&limit=200` | مدیر؛ `{metrics,orders,products,categories,subscribers,reports,pagination}` |
| GET | `/api/admin/orders?offset=0&limit=200` | مدیر؛ `{orders,pagination}` |
| POST | `/api/admin/products` | مدیر؛ کالای کامل بدون شناسه؛ پاسخ ۲۰۱، `{product}` |
| PATCH | `/api/admin/products/:id` | مدیر؛ فیلد تغییر؛ پاسخ `{product}` |
| POST | `/api/admin/categories` | مدیر؛ `{title,icon}`؛ پاسخ ۲۰۱، `{category}` |
| PATCH | `/api/admin/orders/:id` | مدیر؛ `{status}`؛ پاسخ `{order}` |
| PATCH | `/api/admin/settings` | مدیر؛ فیلد تنظیم؛ پاسخ `{settings}` |

- [بدنه]: نوشتن با `Content-Type: application/json`. سقف ۶۴ کیلوبایت. کل بدنه، object باشد.
- [حساب]: نام ۲ تا ۱۲۰ کاراکتر. رمز ۱۲ تا ۱۲۸ کاراکتر. ثبت، همیشه نقش `customer` دهد. مدیر فقط با فرمان محلی ساخته شود.
- [کاربر]: `{id,name,email,role}`. هش رمز و توکن نشست در پاسخ عمومی نیاید.
- [مشتری]: `{name,email,phone,address,postalCode}`. نشانی ۱۰ تا ۱۰۰۰ کاراکتر. شماره ایران `09...`، `+98...` یا `0098...`. کد پستی ۱۰ رقم غیرتکراری. رقم فارسی و عربی عادی شود.
- [کالا]: `{id,name,sku,brand,price,oldPrice?,category,label,visual,color,description,stock,vehicles}`. کد یکتا، دسته با عنوان دقیق. قیمت ۱ تا یک میلیارد تومان، موجودی ۰ تا یک میلیون.
- [قیمت قبل]: خالی یا عدد حداقل برابر قیمت فعلی. هنگام افزایش قیمت، قیمت قبل کوچک‌تر را هم پاک یا اصلاح کن.
- [شکل]: `oil`, `filter`, `brake`, `coolant`, `spark`, `wiper`, `spray`. رنگ، `amber`, `cream`, `red`, `blue`.
- [خودرو]: `vehicles` فقط نام مدل‌های پاسخ کاتالوگ. این فهرست، سازگاری تأییدشده بازار نیست.
- [تنظیم]: `storeName`, `shippingFee`, `freeShippingThreshold`, `contactEmail`, `contactPhone`. تماس خالی مجاز. `paymentMode` در این نسخه `manual`. حالت نمونه از API خاموش نشود.
- [خواندن]: کاتالوگ `Cache-Control: no-cache` و `ETag` دهد. `If-None-Match` برابر، پاسخ ۳۰۴ دهد. تغییر کالا، تنظیم یا موجودی کش را باطل کند. داده مشتری `no-store` بماند.
- [محدودیت]: هر IP تا ۳۰۰ درخواست API در دقیقه. ورود و ثبت مجموع ۱۵ تلاش در ۱۵ دقیقه. سفارش ۲۰ و خبرنامه ۵ تلاش در دقیقه. محدودیت در حافظه یک پردازه است؛ با بازراه‌اندازی پاک شود.
- [صفحه]: `limit` عدد ۱ تا ۲۰۰، پیش‌فرض ۲۰۰. `offset` عدد ۰ تا یک میلیون، پیش‌فرض ۰. پاسخ `pagination:{total,limit,offset,hasMore}`. شمار کل مستقل از طول صفحه است.
- [گزارش]: `reports.byStatus`، ردیف `{status,count,total}` از همه سفارش همان وضعیت. `reports.byDay`، ردیف `{date,count,total}` برای ۳۰ روز UTC؛ count همه سفارش روز، total فقط مبلغ پرداخت‌شده و مراحل پس از آن. مبلغ شامل ارسال است؛ سود خالص نیست.

## نمونه خرید

```json
{
  "items": [{ "productId": 1, "quantity": 1 }],
  "customer": {
    "name": "خریدار آزمون",
    "email": "buyer@example.test",
    "phone": "09123456789",
    "address": "تهران، خیابان آزمون، پلاک ۱۲",
    "postalCode": "1234567890"
  },
  "note": "نمونه درخواست؛ داده واقعی مشتری نیست.",
  "idempotencyKey": "sample-checkout-key-0001"
}
```

- [نمونه]: آدرس و شماره بالا نمایشی. برای هر خرید تازه، کلید تصادفی تازه بساز. در تلاش دوباره همان خرید، کلید و بدنه پیشین بمانند.
- [پاسخ سفارش]: `{id,customer,items:[{productId,name,price,quantity,lineTotal}],subtotal,shipping,total,status,note,createdAt,updatedAt,expiresAt}` در `order` آید. `receiptToken` جدا و خصوصی است؛ در URL یا لاگ نگذار.

## سفارش و موجودی

- [قلم]: `productId` و `quantity` لازم. شمار صحیح ۱ تا ۹۹. حداکثر ۵۰ ردیف. ردیف تکراری جمع شود؛ جمع هر کالا هم بیش از ۹۹ نشود. قیمت ارسالی مرورگر بی‌اثر. سرور قیمت و موجودی زنده بخواند.
- [تراکنش]: سفارش و کم‌شدن همه اقلام با هم ثبت شوند. کمبود یک قلم، کل ثبت را برگرداند.
- [تکرار]: هر تلاش خرید یک کلید یکتا، ۱۶ تا ۱۲۸ حرف لاتین، رقم، `_` یا `-` خواهد. تکرار همان بدنه عادی‌شده و همان حساب با همان کلید، همان سفارش و هدر `Idempotency-Replayed: true` دهد. تغییر بدنه با همان کلید ۴۰۹ دهد.
- [حریم]: سفارش فقط برای مدیر، صاحب حساب، یا دارنده توکن رسید خوانده شود. دانستن شماره سفارش به‌تنهایی کافی نیست.
- [وضعیت]: `pending_payment → paid → processing → shipped → completed`. فقط `pending_payment → cancelled` هم مجاز. پرش و بازگشت رد شود.
- [لغو]: یک بار موجودی پس دهد. تکرار لغو موجودی بیشتر نکند. سفارش لغوشده دیگر پرداخت یا ارسال نشود.
- [گزارش]: درآمد فقط از سفارش پرداخت‌شده و بعدتر. سفارش انتظار و لغو فروش حساب نشود.
- [رزرو]: `expiresAt` مهلت رزرو، پیش‌فرض ۲۴ ساعت پس از ساخت. پاک‌سازی، فقط سفارش هنوز `pending_payment` را لغو و موجودی را دقیق یک بار برگرداند. سفارش پرداخت‌شده منقضی نشود. پاک‌سازی در شروع سرور، بازه دوره‌ای و خرید تازه اجرا شود.
- [نشست و مقیاس]: این نسخه یک میزبان و SQLite دارد. ذخیره نشست پایدار، محدودیت تلاش در حافظه. چند نمونه پشت توازن بار، قرارداد قفل و محدودیت مشترک لازم دارد.
