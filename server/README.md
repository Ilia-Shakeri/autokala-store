# بک‌اند اتوکالا

- [نسخه]: Node.js 22.23 یا بالاتر لازم. ذخیره در SQLite. بسته اجرایی اضافه نیست.
- [داده]: ۱۲ کالای نمونه. قیمت و موجودی نمایشی. `node server/demo.mjs`، ۳۰ سفارش، ۶ مشتری و ۳ عضو خبر ساختگی می‌سازد. نشانی و نام، نشان نمونه دارند؛ ایمیل‌ها `example.test` هستند. رمز ورود آماده ندارد.
- [پرداخت]: دستی. سفارش اول `pending_payment`. پرداخت بانکی وصل نیست. ثبت سفارش یعنی پرداخت نشده.
- [راه‌اندازی]: از ریشه، `node server/index.mjs`. پیش‌فرض `127.0.0.1:3001`.
- [ساخت]: اول `npm.cmd run build`. همان سرور، پوشه `dist` را هم می‌دهد.
- [مدیر]: `node server/admin.mjs --email admin@example.test --name "مدیر فروشگاه"`. رمز در ترمینال پنهان. رمز پیش‌فرض نیست. ایمیل نمونه را عوض کن.
- [رمز فایل]: برای اجرای بی‌تعاملی، `ADMIN_PASSWORD_FILE` مسیر فایل خصوصی رمز باشد. فایل بیرون مخزن، فقط برای کاربر خود. پس از ساخت، فایل پاک کن. رمز در آرگومان نده.
- [بازیابی مدیر]: همان فرمان با `--reset`. حساب موجود مدیر می‌شود؛ نشست‌های آن باطل می‌شود. فقط اپراتور میزبان اجرا کند.
- [نمایش]: فروشگاه `http://127.0.0.1:3001/`؛ مدیر `http://localhost:3001/`. میزبان‌ها جدا؛ پورت یکسان. ثبت‌نام روی میزبان مدیر بسته. حساب مدیر روی فروشگاه وارد نمی‌شود.
- [نمونه]: فرمان `node server/demo.mjs` فقط در `settings.demo=true` کار می‌کند؛ تکرار، داده دوباره نمی‌سازد. سفارش قبلی پاک یا بازنویسی نمی‌شود. موجودی برای سفارش نمونه رزرو می‌شود؛ لغوشده موجودی پس می‌دهد. خطا، کل نمونه‌سازی را برمی‌گرداند. پرداخت و ارسال نمونه واقعی نیست.

| متغیر | پیش‌فرض | کار |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | نشانی گوش دادن |
| `PORT` | `3001` | درگاه |
| `PUBLIC_HOST` | `127.0.0.1` در توسعه | فقط نام میزبان؛ پورت اختیاری |
| `ADMIN_HOST` | `localhost` در توسعه | میزبان جدا برای مدیر؛ پورت اختیاری |
| `DB_PATH` | `server/data/store.sqlite` | مسیر داده پایدار |
| `NODE_ENV` | خالی | برای استقرار `production` |
| `ALLOWED_ORIGINS` | خالی | مبدأهای مجاز، با ویرگول |
| `SECURE_COOKIES` | `false` | پشت HTTPS، `true` |
| `TRUST_PROXY` | `false` | فقط پشت یک پراکسی مورد اعتماد روی loopback، `true` |
| `ADMIN_PASSWORD_FILE` | خالی | فقط فرمان مدیر؛ فایل خصوصی رمز |

- [شبکه]: فقط `PUBLIC_HOST` و `ADMIN_HOST` پذیرفته می‌شوند. میزبان ناشناس ۴۲۱. `X-Forwarded-Host` نادیده. نام میزبان دقیق؛ پسوند جعلی پذیرفته نیست. در توسعه، میزبان بدون پورت روی درگاه ۳۰۰۱ و ۸۴۴۳ کار می‌کند.
- [استقرار]: `NODE_ENV=production`، دو نام DNS جدا و `SECURE_COOKIES=true` لازم. نبودشان، شروع را می‌بندد. نمونه: `PUBLIC_HOST=shop.example.test` و `ADMIN_HOST=admin.shop.example.test`. ثبت DNS و HTTPS واقعی هنوز انجام نشده. تنظیم پورت جدا روی یک نام میزبان کافی نیست؛ کوکی به میزبان وابسته است.
- [مبدأ]: در توسعه، مبدأ فروشگاه درگاه ۸۴۴۳ و ۵۱۷۳ مجاز. در استقرار، مبدأ خود فروشگاه و فهرست `ALLOWED_ORIGINS`. مدیر فقط مبدأ دقیق خودش؛ فهرست فروشگاه برای مدیر اثری ندارد.
- [پراکسی]: با `TRUST_PROXY=true` فقط اتصال loopback برای IP کاربر پذیرفته می‌شود. پراکسی، IP واقعی را آخر `X-Forwarded-For` بگذارد؛ `X-Forwarded-Proto` را بازنویسی کند. `HOST=127.0.0.1` بماند. چند پراکسی زنجیره‌ای، تنظیم و بررسی جدا می‌خواهد.
- [کوکی]: مشتری `autokala_session`، عمر ۱۴ روز و `SameSite=Lax`. مدیر `autokala_admin_session`، عمر ۸ ساعت و `SameSite=Strict`. هر دو `HttpOnly` و فقط میزبان خود؛ `Domain` ندارند. زیر HTTPS، `Secure` و پیشوند `__Host-`. شناسه نشست در داده هش می‌شود. کپی کوکی میان نقش‌ها، ورود نمی‌دهد. کوکی تکراری پذیرفته نیست.
- [رمز]: scrypt با نمک جدا. تلاش ورود و ثبت و درخواست انبوه محدود.
- [طول رمز]: ۱۲ تا ۱۲۸ نویسه. فاصله داخل رمز حفظ می‌شود.
- [سبد]: قیمت از سرور. تعداد صحیح ۱ تا ۹۹. حداکثر ۵۰ ردیف. ردیف تکراری جمع می‌شود. فرانت `expectedTotal` می‌فرستد؛ مبلغ تازه فرق کند، ۴۰۹ و بدون رزرو موجودی. دریافت مبلغ تازه و تأیید دوباره لازم. درخواست قدیمی بدون این فیلد برای سازگاری پذیرفته است؛ پرداخت خودکار ندارد.
- [ویرایش موجودی]: پنل فقط فیلد تغییرکرده را بفرستد. برای تغییر موجودی، `expectedStock` برابر شمار زمان باز شدن فرم هم بفرستد؛ اختلاف با شمار تازه، ۴۰۹ دهد. درخواست قدیمی بدون این نگهبان هنوز پذیرفته شود.
- [سفارش]: تراکنش واحد. رزرو موجودی و ثبت سفارش با هم. کلید تکراری و بدنه برابر، همان سفارش. بدنه فرق، خطای ۴۰۹.
- [لغو]: فقط `pending_payment → cancelled`. موجودی فقط یک بار برمی‌گردد. سفارش پرداخت‌شده، روند بازپرداخت جدا می‌خواهد.
- [رزرو]: پرداخت‌نشده تا ۲۴ ساعت موجودی نگه می‌دارد. پس از مهلت، لغو و موجودی آزاد. پاک‌سازی هنگام شروع، هر دقیقه و پیش از کاتالوگ، محاسبه و ثبت سفارش. مهلت در `expiresAt` رسید هست.
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
| GET | `/health/ready` | `{ready:boolean,staticBuilt:boolean}`؛ داده بررسی می‌شود؛ نبود پوسته معتبر در استقرار، ۵۰۳ و `ready:false` |
| GET | `/api/catalog` | `{products,categories,vehicles,settings}`؛ دارای ETag |
| GET | `/api/context` | `{isAdminHost,publicOrigin}`؛ نام میزبان مدیر روی فروشگاه برنمی‌گردد |
| GET | `/api/session` | `{user:null \| {id,name,email,role},isAdminHost}`؛ فقط نقش میزبان خودش |
| POST | `/api/auth/register` | فقط فروشگاه؛ `{name,email,password}` → مشتری `{user}` و کوکی |
| POST | `/api/auth/login` | `{email,password}` → `{user}` و کوکی؛ نقش باید با میزبان یکی باشد |
| POST | `/api/auth/logout` | `{}` → `{ok:true}` |
| POST | `/api/quote` | `{items:[{productId,quantity}]}` → `{items,subtotal,shipping,total}` |
| POST | `/api/orders` | `{items,customer:{name,email,phone,address,postalCode},note?,idempotencyKey,expectedTotal?}` → `{order,receiptToken}`؛ ۲۰۱ |
| GET | `/api/orders?limit=200&offset=0` | حساب لازم؛ `{orders,pagination:{total,limit,offset,hasMore}}`؛ سقف هر صفحه ۲۰۰ |
| GET | `/api/orders/:id` | `{order}`؛ مهمان هدر `X-Receipt-Token` بدهد |
| POST | `/api/subscribe` | `{phone,consent:true}` → `{ok:true,message}` |
| GET | `/api/admin/overview?limit=200&offset=0` | مدیر؛ `{metrics:{revenue,orders,lowStock,customers,subscribers},orders,pagination,reports,products,categories,subscribers}` |
| GET | `/api/admin/orders?limit=200&offset=0&query=&status=all` | مدیر؛ `{orders,pagination}`؛ همه صفحه‌ها در دسترس |
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
- [گزارش]: `reports.byStatus` فهرست `{status,count,total}` از همه داده. `reports.byDay` فهرست `{date,count,total}` برای ۳۰ روز به وقت تهران. تعداد روز همه سفارش‌ها؛ جمع روز فقط وضعیت پرداخت‌شده و پس از آن. شمار عضو خبر از `metrics.subscribers`، نه اندازه صفحه.
- [صفحه]: `limit` از ۱ تا ۲۰۰؛ پیش‌فرض ۲۰۰. `offset` از ۰ تا ۱۰۰۰۰۰۰. گزارش و آمار، از همه داده؛ محدود به صفحه نیست.
- [جست‌وجو]: `query` تا ۱۲۰ نویسه؛ شناسه، نام، ایمیل و همراه. رقم فارسی و عربی عادی می‌شود. `status` اختیاری؛ یکی از وضعیت‌های سفارش یا `all`. `pagination.total` شمار نتیجه فیلتر. روی سفارش‌های خود کاربر و مدیر کار می‌کند.
- [تنظیمات]: `{storeName,shippingFee,freeShippingThreshold,paymentMode:'manual',demo:true,contactEmail?,contactPhone?}`.
- [مرز]: `/admin` و `/api/admin/**` روی فروشگاه همیشه ۴۰۴؛ کوکی مدیر هم راه نمی‌دهد. روی میزبان مدیر، نشست مدیر لازم. فایل جاوااسکریپت راز ندارد؛ قفل داده و نوشتن در سرور است.
- [تست]: `createApp({dbPath,seed,reservationTtlMs,distPath,allowedOrigins,production,trustProxy,secureCookies,publicHost,adminHost,logger})` از `server/app.mjs`. خروجی `{server,store,handler,close}`. اول `server.listen(0,'127.0.0.1')`؛ پایان `await close()`. درخواست مدیر، `Host: localhost:<port>` بدهد. `store.expireReservations(now)` برای آزمون مهلت، شمار آزادشده می‌دهد.
