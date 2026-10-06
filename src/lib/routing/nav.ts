import 'server-only'

import { pagePath } from '@/lib/runtime'

import type { SiteContext } from '@/lib/cms/context'
import { getSectionRef } from '@/lib/cms/content'
import { getPageById, getPostById } from '@/lib/cms/endpoints'
import type { CmsLink, NavItem, PageDoc, PostDoc } from '@/lib/cms/types'
import { mediaUrl } from '@/lib/utils/media'

import { href } from './locale'
import { THEME_ROUTES } from './paths'
import { resolveThemeRoute } from './resolve'

/**
 * CMS navigation → theme URLs.
 *
 * A menu item is a link group: `type: reference|custom`, with a polymorphic
 * `reference` (`pages` or `posts`). A referenced **page** that is bound to a section
 * slot lands on that section's fixed route (`/about`), not on its editable slug — the
 * customer can rename «درباره ما» without moving the URL.
 */

export type NavLink = {
  current: boolean
  external: boolean
  href: string
  label: string
  newTab: boolean
}

const isExternal = (url: string): boolean => /^(https?:)?\/\//u.test(url) || /^(mailto|tel):/u.test(url)

const normalizeInternal = (url: string): string => (url.startsWith('/') ? url : `/${url}`)

export const linkHref = async (link: CmsLink | null | undefined, ctx: SiteContext): Promise<null | string> => {
  if (!link) return null
  if (link.type === 'custom') {
    const url = (link.url ?? '').trim()
    if (!url) return null
    return isExternal(url) ? url : normalizeInternal(url)
  }

  const reference = link.reference
  if (!reference) return null
  const value = reference.value
  const id = typeof value === 'string' ? value : value?.id
  if (!id) return null

  if (reference.relationTo === 'pages') {
    const home = getSectionRef('home', ctx)
    const about = getSectionRef('about', ctx)
    const contact = getSectionRef('contact', ctx)
    if (home.by === 'binding' && home.id === id) return href(THEME_ROUTES.home, ctx.locale, ctx.site)
    if (about.by === 'binding' && about.id === id) return href(THEME_ROUTES.about, ctx.locale, ctx.site)
    if (contact.by === 'binding' && contact.id === id) return href(THEME_ROUTES.contact, ctx.locale, ctx.site)

    const page: null | PageDoc = await getPageById(id, ctx.locale, ctx.draft)
    if (!page) return null
    return href(pagePath(page.slug), ctx.locale, ctx.site)
  }

  // A `posts` reference stores an **id**; the archive URL depends on the section the
  // post belongs to, which is only knowable from the resolved document.
  const post: null | PostDoc = await getPostById(id, ctx.locale, ctx.draft)
  if (!post) return null
  const { postHref } = await import('@/lib/cms/content')
  return href(await postHref(post, ctx), ctx.locale, ctx.site)
}

export const navLinks = async (
  items: NavItem[] | null | undefined,
  ctx: SiteContext,
  currentPath: string,
): Promise<NavLink[]> => {
  const resolved = await Promise.all(
    (items ?? []).map(async (item) => {
      const link = item.link
      const target = await linkHref(link, ctx)
      if (!target) return null
      const label = (link?.label ?? '').trim() || labelFromUrl(target)
      const external = isExternal(target)
      return {
        current: !external && samePath(target, currentPath),
        external,
        href: target,
        label,
        newTab: Boolean(link?.newTab),
      } satisfies NavLink
    }),
  )
  return resolved.filter((entry): entry is NavLink => Boolean(entry))
}

const labelFromUrl = (url: string): string => {
  try {
    const pathname = url.startsWith('http') ? new URL(url).pathname : url
    const last = pathname.split('/').filter(Boolean).at(-1) ?? ''
    return decodeURIComponent(last)
  } catch {
    return url
  }
}

/** Compares only the pathname (query strings must not affect "current"). */
export const samePath = (a: string, b: string): boolean => {
  const path = (value: string): string => {
    try {
      return (value.startsWith('http') ? new URL(value).pathname : value.split('?')[0] ?? value).replace(/\/$/, '') || '/'
    } catch {
      return value
    }
  }
  return path(a) === path(b)
}

/**
 * Logo URLs for the chrome, both slots resolved: `primary` for the desktop header,
 * `compact` for phones/tablets (each falls back to the other when only one asset was
 * uploaded — `Logo` then renders a single image). Never bundled artwork.
 */
export const brandLogo = (ctx: SiteContext) => {
  const branding = ctx.site.branding
  const origin = ctx.site.media.origin
  const compact = mediaUrl(branding?.compactLogo ?? branding?.logoCompact ?? null, origin)
  const primary = mediaUrl(branding?.primaryLogo ?? branding?.logo ?? null, origin)
  const home = mediaUrl(branding?.homeLogo ?? null, origin)
  return { compact: compact ?? primary, home: home ?? primary, primary }
}

/** Route helper reused by `generateMetadata` and page bodies. */
export const routePathFor = (segments: string[], ctx: SiteContext): string => {
  const route = resolveThemeRoute(segments, ctx.site)
  return href('/', route.locale, ctx.site)
}
