import type { Locale } from '@/lib/cms/types'

/**
 * Interface strings. Exactly two locales are designed — Persian first, English second
 * — and this is the only place a UI word lives, so a component never hardcodes one.
 * Content is localized in the CMS; this dictionary is chrome only.
 */
type Dictionary = {
  about: string
  allProjects: string
  blog: string
  breadcrumb: string
  close: string
  contact: string
  emptyArchiveBody: string
  emptyArchiveTitle: string
  enter: string
  errorBody: string
  errorTitle: string
  education: string
  featured: string
  filterLabel: string
  formError: string
  formPending: string
  formSuccess: string
  home: string
  languageSwitch: string
  latestNotes: string
  leadStory: string
  loadMore: string
  loading: string
  menu: string
  menuNoScript: string
  menuTitle: string
  next: string
  notFoundBody: string
  notFoundTitle: string
  pagination: string
  previous: string
  projects: string
  readMore: string
  readingTime: (minutes: number) => string
  reload: string
  search: string
  searchEmpty: string
  searchPlaceholder: string
  skipToContent: string
  scrollCue: string
  holdingTitle: string
  holdingBody: string
  unreachableTitle: string
  unreachableBody: string
  relatedEntries: string
  relatedProjects: string
  gallery: string
  projectFacts: string
  photo: string
  map: string
}

const fa: Dictionary = {
  about: 'درباره ما',
  allProjects: 'همه پروژه‌ها',
  blog: 'یادداشت‌ها',
  breadcrumb: 'مسیر صفحه',
  close: 'بستن',
  contact: 'تماس',
  emptyArchiveBody: 'به‌زودی در این بخش محتوایی منتشر می‌شود.',
  emptyArchiveTitle: 'هنوز چیزی منتشر نشده است',
  enter: 'ورود',
  errorBody: 'نمایش این بخش ممکن نشد. می‌توانید دوباره تلاش کنید.',
  errorTitle: 'خطا در بارگذاری',
  education: 'آموزش',
  featured: 'شاخص',
  filterLabel: 'دسته‌بندی',
  formError: 'ارسال فرم انجام نشد. مقادیر وارد‌شده حفظ شده‌اند؛ دوباره تلاش کنید.',
  formPending: 'در حال ارسال…',
  formSuccess: 'پیام شما ثبت شد.',
  home: 'خانه',
  languageSwitch: 'زبان',
  latestNotes: 'تازه‌ترین یادداشت‌ها',
  leadStory: 'یادداشت شاخص',
  loadMore: 'بیشتر',
  loading: 'در حال بارگذاری…',
  menu: 'فهرست',
  menuNoScript: 'بدون جاوااسکریپت هم می‌توانید از این پیوندها استفاده کنید:',
  menuTitle: 'فهرست سایت',
  next: 'بعدی',
  notFoundBody: 'نشانی درخواستی در این سایت وجود ندارد.',
  notFoundTitle: 'صفحه پیدا نشد',
  pagination: 'صفحه‌بندی',
  previous: 'پیشین',
  projects: 'پروژه‌ها',
  readMore: 'ادامه',
  readingTime: (minutes) => `${minutes} دقیقه مطالعه`,
  reload: 'تلاش دوباره',
  search: 'جست‌وجو',
  searchEmpty: 'برای این جست‌وجو نتیجه‌ای پیدا نشد.',
  searchPlaceholder: 'عبارت مورد نظر…',
  scrollCue: 'برای دیدن فهرست، اسکرول کنید',
  skipToContent: 'رفتن به محتوا',
  holdingTitle: 'این سایت موقتاً در دسترس نیست',
  holdingBody: 'در حال حاضر امکان نمایش محتوای این سایت وجود ندارد.',
  unreachableTitle: 'اتصال به سامانهٔ محتوا برقرار نشد',
  unreachableBody: 'این نسخه به CMS متصل نیست. تنظیمات اتصال را بررسی کنید.',
  relatedEntries: 'مطالب مرتبط',
  relatedProjects: 'پروژه‌های مرتبط',
  gallery: 'تصاویر',
  projectFacts: 'مشخصات پروژه',
  photo: 'تصویر',
  map: 'نقشه',
}

const en: Dictionary = {
  about: 'About',
  allProjects: 'All projects',
  blog: 'Notes',
  breadcrumb: 'Breadcrumb',
  close: 'Close',
  contact: 'Contact',
  emptyArchiveBody: 'New work will be published here soon.',
  emptyArchiveTitle: 'Nothing published yet',
  enter: 'Enter',
  errorBody: 'This section could not be displayed. Try again.',
  errorTitle: 'Loading error',
  education: 'Education',
  featured: 'Featured',
  filterLabel: 'Category',
  formError: 'The form could not be sent. Your input was kept — try again.',
  formPending: 'Sending…',
  formSuccess: 'Your message was received.',
  home: 'Home',
  languageSwitch: 'Language',
  latestNotes: 'Latest notes',
  leadStory: 'Lead story',
  loadMore: 'Load more',
  loading: 'Loading…',
  menu: 'Menu',
  menuNoScript: 'These links work without JavaScript as well:',
  menuTitle: 'Site menu',
  next: 'Next',
  notFoundBody: 'The requested address does not exist on this site.',
  notFoundTitle: 'Page not found',
  pagination: 'Pagination',
  previous: 'Previous',
  projects: 'Projects',
  readMore: 'Read',
  readingTime: (minutes) => `${minutes} min read`,
  reload: 'Try again',
  search: 'Search',
  searchEmpty: 'No results for this search.',
  searchPlaceholder: 'Search…',
  scrollCue: 'Scroll to see the menu',
  skipToContent: 'Skip to content',
  holdingTitle: 'This site is temporarily unavailable',
  holdingBody: 'Its content cannot be displayed right now.',
  unreachableTitle: 'The content system could not be reached',
  unreachableBody: 'This deployment is not connected to the CMS. Check the connection settings.',
  relatedEntries: 'Related',
  relatedProjects: 'Related projects',
  gallery: 'Gallery',
  projectFacts: 'Project facts',
  photo: 'Photograph',
  map: 'Map',
}

const dictionaries: Record<Locale, Dictionary> = { en, fa }

export const labels = (locale: Locale): Dictionary => dictionaries[locale] ?? fa

export type { Dictionary }
