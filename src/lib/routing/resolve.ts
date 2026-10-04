import { POSTS_SEGMENT, SEARCH_SEGMENT } from '@eshobe/site-runtime/slug'

import type { Locale, SiteDescriptor } from '@/lib/cms/types'

import { splitLocale } from './locale'

/**
 * Path → route. Pure and shared by `generateMetadata`, the page bodies, the sitemap
 * and the alias redirects, so a canonical URL cannot drift from what renders.
 */

export type ThemeRoute =
  | { kind: 'about' }
  | { kind: 'article'; slug: string }
  | { kind: 'blog'; page: number }
  | { kind: 'contact' }
  | { kind: 'education'; page: number }
  | { kind: 'educationEntry'; slug: string }
  | { kind: 'home' }
  | { kind: 'notFound'; reason: 'empty' | 'reserved' | 'unsupported-locale'; detail?: string }
  | { kind: 'page'; slug: string }
  | { kind: 'project'; slug: string }
  | { kind: 'projects'; page: number }
  | { kind: 'search'; query: string }
  /** CMS-reserved `/posts…` paths, redirected to the theme's blog route. */
  | { kind: 'alias'; to: string }

export type ResolvedRoute = ThemeRoute & {
  explicitLocale: boolean
  locale: Locale
}

const pageNumber = (value: null | string | undefined): number => {
  const parsed = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export const resolveThemeRoute = (
  segments: string[],
  site: Pick<SiteDescriptor, 'availableLocales' | 'defaultLocale'>,
  search: { page?: null | string; q?: null | string } = {},
): ResolvedRoute => {
  const split = splitLocale(segments, site)
  if ('unsupported' in split) {
    return {
      explicitLocale: true,
      kind: 'notFound',
      locale: site.defaultLocale,
      reason: 'unsupported-locale',
      detail: split.unsupported,
    }
  }

  const base = { explicitLocale: split.explicit, locale: split.locale }
  const [head, second] = split.rest

  if (!head) return { ...base, kind: 'home' }

  switch (head) {
    case 'projects':
      return second
        ? { ...base, kind: 'project', slug: decodeURIComponent(second) }
        : { ...base, kind: 'projects', page: pageNumber(search.page) }

    case 'education':
      return second
        ? { ...base, kind: 'educationEntry', slug: decodeURIComponent(second) }
        : { ...base, kind: 'education', page: pageNumber(search.page) }

    case 'blog':
      return second
        ? { ...base, kind: 'article', slug: decodeURIComponent(second) }
        : { ...base, kind: 'blog', page: pageNumber(search.page) }

    case 'about':
      return second ? { ...base, kind: 'notFound', reason: 'empty' } : { ...base, kind: 'about' }

    case 'contact':
      return second ? { ...base, kind: 'notFound', reason: 'empty' } : { ...base, kind: 'contact' }

    case SEARCH_SEGMENT:
      return { ...base, kind: 'search', query: (search.q ?? '').trim() }

    // The CMS contract reserves `/posts`; the theme's canonical blog lives at /blog.
    case POSTS_SEGMENT:
      return second
        ? { ...base, kind: 'alias', to: `/blog/${encodeURIComponent(decodeURIComponent(second))}` }
        : { ...base, kind: 'alias', to: '/blog' }

    default: {
      // More than one segment that does not start a section is not a theme route; the
      // caller asks the CMS for a single-slug page.
      if (split.rest.length > 1) return { ...base, kind: 'notFound', reason: 'empty' }
      return { ...base, kind: 'page', slug: decodeURIComponent(head) }
    }
  }
}

/**
 * Resolve a route whose locale the caller already knows. Route files render one locale
 * each, so prepending the served prefix keeps `route.locale` — and therefore breadcrumb
 * labels, parent links and `aria-current` — in the page's own language. Locale-agnostic
 * callers (`CatchAllView`, `SectionLoading`) keep using `resolveThemeRoute` with the
 * real segment list, which already carries the prefix.
 */
export const resolveLocaleRoute = (
  segments: string[],
  locale: Locale,
  site: Pick<SiteDescriptor, 'availableLocales' | 'defaultLocale'>,
  search?: { page?: null | string; q?: null | string },
): ResolvedRoute =>
  resolveThemeRoute(locale === site.defaultLocale ? segments : [locale, ...segments], site, search)

/** Sections whose own slug may arrive through the catch-all and must redirect home. */
export const CANONICAL_SECTION_SLUGS = ['about', 'contact'] as const
