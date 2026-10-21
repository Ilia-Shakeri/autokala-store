export const categories = [
  { title: 'روغن و سیالات', icon: 'oil' },
  { title: 'فیلترها', icon: 'filter' },
  { title: 'لنت و ترمز', icon: 'brake' },
  { title: 'شمع و برق', icon: 'spark' },
  { title: 'برف‌پاک‌کن', icon: 'wiper' },
  { title: 'نظافت خودرو', icon: 'spray' },
]

export const vehicles = [
  { brand: 'ایران خودرو', model: 'پژو ۲۰۶ تیپ ۲', years: Array.from({ length: 15 }, (_, i) => 1388 + i) },
  { brand: 'ایران خودرو', model: 'پژو ۴۰۵', years: Array.from({ length: 15 }, (_, i) => 1385 + i) },
  { brand: 'ایران خودرو', model: 'سمند EF7', years: Array.from({ length: 17 }, (_, i) => 1388 + i) },
  { brand: 'سایپا', model: 'پراید', years: Array.from({ length: 15 }, (_, i) => 1385 + i) },
  { brand: 'سایپا', model: 'تیبا', years: Array.from({ length: 14 }, (_, i) => 1390 + i) },
]

const all = vehicles.map(({ model }) => model)
export const products = [
  { name: 'روغن موتور بهران سوپر پیشتاز 10W-40 چهار لیتری', sku: 'OIL-BHR-1040-4', brand: 'بهران', price: 765000, oldPrice: 850000, category: 'روغن و سیالات', label: 'نمونه', visual: 'oil', color: 'amber', description: 'روغن چهار لیتری نیمه‌سنتتیک. گرانروی و سطح کیفی را با دفترچه خودرو تطبیق دهید. قیمت و موجودی برای نمایش فروشگاه است.', stock: 18, vehicles: ['پژو ۴۰۵', 'سمند EF7', 'پراید', 'تیبا'] },
  { name: 'فیلتر هوای سرکان مناسب پژو ۲۰۶ تیپ ۲', sku: 'FLT-SRK-206-A', brand: 'سرکان', price: 245000, category: 'فیلترها', label: 'نمونه', visual: 'filter', color: 'cream', description: 'فیلتر هوای موتور TU3. پیش از خرید، کد فنی و شکل قطعه قبلی بررسی شود. کالای نمونه با قیمت نمایشی.', stock: 25, vehicles: ['پژو ۲۰۶ تیپ ۲'] },
  { name: 'لنت ترمز جلوی امکو مناسب پژو ۴۰۵ و سمند', sku: 'BRK-EMC-405-F', brand: 'امکو', price: 1280000, oldPrice: 1460000, category: 'لنت و ترمز', label: 'نمونه', visual: 'brake', color: 'red', description: 'یک دست لنت محور جلو. تطبیق سیستم ترمز و کد فنی توسط تعمیرکار لازم است. این موجودی برای نمایش است.', stock: 10, vehicles: ['پژو ۴۰۵', 'سمند EF7'] },
  { name: 'ضدیخ و ضدجوش کاسپین یک لیتری', sku: 'CLT-CSP-1L', brand: 'کاسپین', price: 310000, category: 'روغن و سیالات', label: 'نمونه', visual: 'coolant', color: 'blue', description: 'کنسانتره ضدیخ یک لیتری. نسبت اختلاط و سازگاری را از برچسب و دفترچه بررسی کنید. قیمت نمایشی است.', stock: 20, vehicles: all },
  { name: 'فیلتر روغن سرکان مناسب پراید و تیبا', sku: 'FLT-SRK-PRD-O', brand: 'سرکان', price: 128000, category: 'فیلترها', label: 'نمونه', visual: 'filter', color: 'cream', description: 'فیلتر روغن پیچی برای موتورهای رایج پراید و تیبا. کد فنی پیش از نصب بررسی شود. کالای نمونه.', stock: 32, vehicles: ['پراید', 'تیبا'] },
  { name: 'لنت ترمز جلوی پارس مناسب پراید', sku: 'BRK-PRS-PRD-F', brand: 'پارس', price: 620000, category: 'لنت و ترمز', label: 'نمونه', visual: 'brake', color: 'red', description: 'یک دست لنت محور جلوی پراید. نصب و بررسی دیسک ترمز به تعمیرکار سپرده شود. قیمت نمایشی.', stock: 14, vehicles: ['پراید'] },
  { name: 'شمع موتور پایه کوتاه مناسب پژو ۴۰۵، بسته ۴ عددی', sku: 'SPK-STD-405-4', brand: 'نمونه آموزشی', price: 480000, category: 'شمع و برق', label: 'نمونه', visual: 'spark', color: 'cream', description: 'بسته چهار عددی شمع. طول رزوه، درجه حرارتی و فاصله دهانه باید با موتور تطبیق داده شود. موجودی نمونه.', stock: 16, vehicles: ['پژو ۴۰۵'] },
  { name: 'شمع موتور مناسب پراید، بسته ۴ عددی', sku: 'SPK-STD-PRD-4', brand: 'نمونه آموزشی', price: 395000, category: 'شمع و برق', label: 'نمونه', visual: 'spark', color: 'blue', description: 'بسته چهار عددی برای نمایش دسته شمع. کد فنی باید پیش از خرید تأیید شود. قیمت و موجودی نمایشی.', stock: 12, vehicles: ['پراید'] },
  { name: 'تیغه برف‌پاک‌کن پژو ۲۰۶، جفت جلو', sku: 'WPR-STD-206-2', brand: 'نمونه آموزشی', price: 360000, category: 'برف‌پاک‌کن', label: 'نمونه', visual: 'wiper', color: 'blue', description: 'جفت تیغه جلو. اندازه دو تیغه و نوع اتصال بازو با قطعه خودرو بررسی شود. محصول نمونه.', stock: 17, vehicles: ['پژو ۲۰۶ تیپ ۲'] },
  { name: 'تیغه برف‌پاک‌کن پراید، جفت جلو', sku: 'WPR-STD-PRD-2', brand: 'نمونه آموزشی', price: 290000, category: 'برف‌پاک‌کن', label: 'نمونه', visual: 'wiper', color: 'cream', description: 'دو تیغه برای بازوی رایج پراید. اندازه و نوع اتصال پیش از خرید کنترل شود. قیمت نمایشی.', stock: 19, vehicles: ['پراید'] },
  { name: 'شامپوی بدنه خودرو کاسپین ۵۰۰ میلی‌لیتری', sku: 'CLN-CSP-SHP-500', brand: 'کاسپین', price: 185000, category: 'نظافت خودرو', label: 'نمونه', visual: 'spray', color: 'blue', description: 'شامپوی بدنه برای شست‌وشو با آب. نسبت رقیق‌سازی مطابق برچسب محصول باشد. موجودی نمونه.', stock: 22, vehicles: all },
  { name: 'اسپری شیشه‌پاک‌کن خودرو ۵۰۰ میلی‌لیتری', sku: 'CLN-STD-GLS-500', brand: 'نمونه آموزشی', price: 98000, category: 'نظافت خودرو', label: 'نمونه', visual: 'spray', color: 'amber', description: 'پاک‌کننده شیشه برای نمایش فروشگاه. سازگاری با پوشش و دودی شیشه روی برچسب بررسی شود. قیمت نمایشی.', stock: 30, vehicles: all },
]
