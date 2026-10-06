import 'server-only'

import type { SiteContext } from '@/lib/cms/context'
import { cmsEnv, cmsFetchOptional } from '@/lib/cms/client'
import type { Locale, PageDoc, PostDoc } from '@/lib/cms/types'
import { href } from '@/lib/routing/locale'

/**
 * Translation presence, asked of the CMS instead of guessed.
 *
 * A document is "translated" in a locale when the localized `title` is non-empty at
 * `fallbackLocale=false` — existence alone is not enough, because Payload returns the
 * document with empty localized fields when a translation is missing. Sitemap
 * entries, `hreflang` and the language switch all consume this single answer, so a
 * missing translation can never be advertised as a URL.
 */

export type DocKind = 'page' | 'post'

const titleAt = async (kind: DocKind, id: string, locale: Locale, draft: boolean): Promise<null | string> => {
  const env = cmsEnv()
  const path = kind === 'page' ? `/api/pages/${encodeURIComponent(id)}` : `/api/posts/${encodeURIComponent(id)}`
  const doc = await cmsFetchOptional<PageDoc | PostDoc>(path, {
    draft,
    locale,
    params: { depth: 0, fallbackLocale: false, locale, select: { title: true } },
    revalidate: 300,
    tags: [`cms:${env.tenantKey}:${kind === 'page' ? 'pages' : 'posts'}:${locale}`],
  })
  const title = doc?.title
  return typeof title === 'string' && title.trim().length > 0 ? title : null
}

export const translatedInLocales = async (
  ctx: SiteContext,
  kind: DocKind,
  id: string,
): Promise<Locale[]> => {
  const results = await Promise.all(
    ctx.site.availableLocales.map(async (locale) => ({
      locale,
      title: await titleAt(kind, id, locale, ctx.draft),
    })),
  )
  return results.filter((entry) => entry.title).map((entry) => entry.locale)
}

/**
 * One entry per available locale, the current one included: the data layer answers
 * "where does this document live in each language", and `LanguageSwitch` decides
 * what to show (only the *other* language, never the one being read).
 */
export type SwitchTarget = { href: null | string; label: string; locale: Locale }

const localeLabel = (locale: Locale): string => (locale === 'fa' ? 'فارسی' : 'English')

/**
 * Language-switch targets for a document. A locale where the document does not exist
 * yields `href: null` (rendered as non-interactive text), never a link to the home
 * page dressed up as a translation.
 */
export const switchTargets = async (
  ctx: SiteContext,
  options: { id: string; kind: DocKind; pathForLocale: (locale: Locale) => string },
): Promise<SwitchTarget[]> => {
  const translated = await translatedInLocales(ctx, options.kind, options.id)
  return ctx.site.availableLocales.map((locale) => ({
    href: translated.includes(locale) ? href(options.pathForLocale(locale), locale, ctx.site) : null,
    label: localeLabel(locale),
    locale,
  }))
}

/** Fallback used by the chrome when the current view has no document (archives). */
export const switchTargetsForPath = (
  ctx: SiteContext,
  pathForLocale: (locale: Locale) => string,
  query = '',
): SwitchTarget[] =>
  ctx.site.availableLocales.map((locale) => ({
    // A query is carried over only when it is locale-neutral — the search term is free
    // text in whatever the visitor typed, while a category slug belongs to one locale
    // and pointing another locale at it would filter by a slug that does not exist there.
    href: href(`${pathForLocale(locale)}${query}`, locale, ctx.site),
    label: localeLabel(locale),
    locale,
  }))
