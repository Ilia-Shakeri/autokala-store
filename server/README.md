# بک‌اند اتوکالا

- [نسخه]: Node.js 22.13 یا بالاتر لازم. ذخیره در SQLite. بسته اجرایی اضافه نیست.
- [داده]: ۱۲ کالای نمونه. قیمت و موجودی نمایشی. سفارش و فروش ساختگی نیست.
- [پرداخت]: دستی. سفارش اول `pending_payment`. پرداخت بانکی وصل نیست. ثبت سفارش یعنی پرداخت نشده.
- [راه‌اندازی]: از ریشه، `node server/index.mjs`. پیش‌فرض `127.0.0.1:3001`.
- [ساخت]: اول `npm.cmd run build`. همان سرور، پوشه `dist` را هم می‌دهد.
- [مدیر]: `node server/admin.mjs --email admin@example.test --name "مدیر فروشگاه"`. رمز در ترمینال پنهان. رمز پیش‌فرض نیست. ایمیل نمونه را عوض کن.
- [رمز فایل]: برای اجرای بی‌تعاملی، `ADMIN_PASSWORD_FILE` مسیر فایل خصوصی رمز باشد. فایل بیرون مخزن، فقط برای کاربر خود. پس از ساخت، فایل پاک کن. رمز در آرگومان نده.
- [بازیابی مدیر]: همان فرمان با `--reset`. حساب موجود مدیر می‌شود؛ نشست‌های آن باطل می‌شود. فقط اپراتور میزبان اجرا کند.

| متغیر | پیش‌فرض | کار |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | نشانی گوش دادن |
| `PORT` | `3001` | درگاه |
| `DB_PATH` | `server/data/store.sqlite` | مسیر داده پایدار |
| `NODE_ENV` | خالی | برای استقرار `production` |
| `ALLOWED_ORIGINS` | خالی | مبدأهای مجاز، با ویرگول |
| `SECURE_COOKIES` | `false` | پشت HTTPS، `true` |
| `TRUST_PROXY` | `false` | فقط پشت پراکسی مورد اعتماد `true` |
| `ADMIN_PASSWORD_FILE` | خالی | فقط فرمان مدیر؛ فایل خصوصی رمز |

- [شبکه]: در توسعه مبدأهای محلی درگاه ۸۴۴۳ و ۵۱۷۳ مجاز. در استقرار فقط مبدأ خود سرور و فهرست بالا.
- [کوکی]: `HttpOnly`, `SameSite=Lax`، عمر ۱۴ روز. زیر HTTPS، `Secure`. شناسه نشست در داده هش می‌شود.
- [رمز]: scrypt با نمک جدا. تلاش ورود و ثبت و درخواست انبوه محدود.
- [طول رمز]: ۱۲ تا ۱۲۸ نویسه. فاصله داخل رمز حفظ می‌شود.
- [سبد]: قیمت از سرور. تعداد صحیح ۱ تا ۹۹. حداکثر ۵۰ ردیف. ردیف تکراری جمع می‌شود.
- [سفارش]: تراکنش واحد. رزرو موجودی و ثبت سفارش با هم. کلید تکراری و بدنه برابر، همان سفارش. بدنه فرق، خطای ۴۰۹.
- [لغو]: فقط `pending_payment → cancelled`. موجودی فقط یک بار برمی‌گردد. سفارش پرداخت‌شده، روند بازپرداخت جدا می‌خواهد.
- [رزرو]: پرداخت‌نشده تا ۲۴ ساعت موجودی نگه می‌دارد. پس از مهلت، لغو و موجودی آزاد. پاک‌سازی هنگام شروع، هر دقیقه و پیش از محاسبه و ثبت سفارش. مهلت در `expiresAt` رسید هست.
- [وضعیت]: `pending_payment → paid → processing → shipped → completed`. مدیر پرداخت واقعی را بررسی کند، بعد `paid` بزند.
- [حریم]: سفارش فقط برای مالک حساب، مدیر، یا دارنده رمز رسید. رمز رسید را مثل رمز حساب نگه دار.
- [خبر]: رضایت روشن لازم. شماره ذخیره می‌شود. ارسال پیام هنوز وصل نیست.
- [داده زنده]: کالا، کد فنی، قیمت، موجودی و راه تماس واقعی لازم. حالت نمونه از پنل خاموش نمی‌شود.
- [پشتیبان]: `node server/backup.mjs <path.sqlite>` یک نسخه سازگار می‌گیرد. فایل و رمز رسید داخل داده خصوصی؛ دسترسی محدود بده. بازیابی فقط با توقف سرور؛ فایل داده و فایل‌های `-wal` و `-shm` قدیمی کنار هم استفاده نشوند.
- [کیفیت]: امتیاز فقط با تست. ۹ از ۱۰ برای دامنه محلی؛ درگاه، پیام و داده زنده، مدرک جدا می‌خواهد.

## قرارداد

- [درخواست]: بدنه نوشتن `application/json`. سقف ۶۴ کیلوبایت. خطا `{ "error": "پیام" }`.
- [ارز]: همه عددها تومان. قیمت صحیح. سفارش، نام و قیمت زمان ثبت را نگه می‌دارد.
- [ورودی ایران]: رقم فارسی و عربی شماره و کد پستی عادی می‌شود. همراه `09...` یا `+98...`. کد پستی ده رقم.

| روش | مسیر | بدنه / پاسخ |
| --- | --- | --- |
| GET | `/health/live` | `{live:true}` |
| GET | `/health/ready` | `{ready:true,staticBuilt:boolean}`؛ داده بررسی می‌شود |
| GET | `/api/catalog` | `{products,categories,vehicles,settings}`؛ دارای ETag |
| GET | `/api/session` | `{user:null \| {id,name,email,role}}` |
| POST | `/api/auth/register` | `{name,email,password}` → `{user}` و کوکی |
| POST | `/api/auth/login` | `{email,password}` → `{user}` و کوکی |
| POST | `/api/auth/logout` | `{}` → `{ok:true}` |
| POST | `/api/quote` | `{items:[{productId,quantity}]}` → `{items,subtotal,shipping,total}` |
| POST | `/api/orders` | `{items,customer:{name,email,phone,address,postalCode},note?,idempotencyKey}` → `{order,receiptToken}`؛ ۲۰۱ |
| GET | `/api/orders?limit=200&offset=0` | حساب لازم؛ `{orders,pagination:{total,limit,offset,hasMore}}`؛ سقف هر صفحه ۲۰۰ |
| GET | `/api/orders/:id` | `{order}`؛ مهمان هدر `X-Receipt-Token` بدهد |
| POST | `/api/subscribe` | `{phone,consent:true}` → `{ok:true,message}` |
| GET | `/api/admin/overview?limit=200&offset=0` | مدیر؛ `{metrics:{revenue,orders,lowStock,customers},orders,pagination,reports,products,categories,subscribers}` |
| GET | `/api/admin/orders?limit=200&offset=0` | مدیر؛ `{orders,pagination}`؛ همه صفحه‌ها در دسترس |
| POST | `/api/admin/products` | مدیر؛ کالای کامل → `{product}` |
| PATCH | `/api/admin/products/:id` | مدیر؛ فیلدهای تغییر → `{product}` |
| PATCH | `/api/admin/orders/:id` | مدیر؛ `{status}` → `{order}` |
| POST | `/api/admin/categories` | مدیر؛ `{title,icon}` → `{category}` |
| PATCH | `/api/admin/settings` | مدیر؛ `{storeName?,shippingFee?,freeShippingThreshold?,contactEmail?,contactPhone?}` → `{settings}` |

- [کالا]: `{id,name,sku,brand,price,oldPrice?,category,label,visual,color,description,stock,vehicles}`. دسته با عنوان دقیق. `vehicles` فهرست مدل خودرو.
- [شکل]: `oil`, `filter`, `brake`, `coolant`, `spark`, `wiper`, `spray`. رنگ: `amber`, `cream`, `red`, `blue`.
- [دسته]: `{id,title,icon,count}`. شمار از کالای موجود در داده؛ ساختگی نیست.
- [خودرو]: `{brand,model,years:number[]}`. سازگاری نمونه، تأیید فنی خرید لازم.
- [سفارش]: `{id,customer,items:[{productId,name,price,quantity,lineTotal}],subtotal,shipping,total,status,note,createdAt,updatedAt,expiresAt}`.
- [گزارش]: `reports.byStatus` فهرست `{status,count,total}` از همه داده. `reports.byDay` فهرست `{date,count,total}` برای ۳۰ روز UTC. تعداد روز همه سفارش‌ها؛ جمع روز فقط وضعیت پرداخت‌شده و پس از آن.
- [صفحه]: `limit` از ۱ تا ۲۰۰؛ پیش‌فرض ۲۰۰. `offset` از ۰ تا ۱۰۰۰۰۰۰. گزارش و آمار، از همه داده؛ محدود به صفحه نیست.
- [تنظیمات]: `{storeName,shippingFee,freeShippingThreshold,paymentMode:'manual',demo:true,contactEmail?,contactPhone?}`.
- [تست]: `createApp({dbPath,seed,reservationTtlMs,distPath,allowedOrigins,production,trustProxy,secureCookies,logger})` از `server/app.mjs`. خروجی `{server,store,handler,close}`. اول `server.listen(0,'127.0.0.1')`؛ پایان `await close()`. `store.expireReservations(now)` برای آزمون مهلت، شمار آزادشده می‌دهد.
