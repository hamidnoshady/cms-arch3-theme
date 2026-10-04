import { describe, expect, it } from 'vitest'

import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href, splitLocale } from '@/lib/routing/locale'
import { articlePath, categoryQuery, projectPath, searchPath } from '@/lib/routing/paths'
import { resolveLocaleRoute, resolveThemeRoute } from '@/lib/routing/resolve'
import type { Locale, SiteDescriptor } from '@/lib/cms/types'

const site = {
  availableLocales: ['fa', 'en'] as Locale[],
  defaultLocale: 'fa' as Locale,
} as unknown as Pick<SiteDescriptor, 'availableLocales' | 'defaultLocale'>

describe('locale splitting', () => {
  it('treats the default locale as unprefixed', () => {
    expect(splitLocale(['projects', 'masjed'], site)).toEqual({
      explicit: false,
      locale: 'fa',
      rest: ['projects', 'masjed'],
    })
  })

  it('recognises a served locale prefix', () => {
    expect(splitLocale(['en', 'projects'], site)).toEqual({
      explicit: true,
      locale: 'en',
      rest: ['projects'],
    })
  })

  it('refuses a locale the site does not serve instead of falling back to the default', () => {
    const persianOnly = { availableLocales: ['fa'] as Locale[], defaultLocale: 'fa' as Locale }
    const outcome = splitLocale(['en', 'projects'], persianOnly)
    expect('unsupported' in outcome).toBe(true)

    // …and it must not be rendered as a page either.
    expect(resolveThemeRoute(['en', 'projects'], persianOnly as never)).toMatchObject({
      kind: 'notFound',
      reason: 'unsupported-locale',
    })
  })
})

describe('route resolution', () => {
  it('maps the empty path to home', () => {
    expect(resolveThemeRoute([], site).kind).toBe('home')
  })

  it('maps sections, details and archives', () => {
    expect(resolveThemeRoute(['about'], site).kind).toBe('about')
    expect(resolveThemeRoute(['contact'], site).kind).toBe('contact')
    expect(resolveThemeRoute(['projects'], site).kind).toBe('projects')
    expect(resolveThemeRoute(['projects', 'x'], site).kind).toBe('project')
    expect(resolveThemeRoute(['education', 'x'], site).kind).toBe('educationEntry')
    expect(resolveThemeRoute(['blog', 'x'], site).kind).toBe('article')
    expect(resolveThemeRoute(['blog'], site).kind).toBe('blog')
  })

  it('resolves the English tree with the locale carried on the route', () => {
    const route = resolveThemeRoute(['en', 'projects'], site)
    expect(route.kind).toBe('projects')
    expect(route.locale).toBe('en')
    expect(route.explicitLocale).toBe(true)
  })

  it('aliases the CMS-reserved /posts paths onto the theme blog route', () => {
    expect(resolveThemeRoute(['posts'], site)).toMatchObject({ kind: 'alias', to: '/blog' })
    expect(resolveThemeRoute(['posts', 'a-note'], site)).toMatchObject({
      kind: 'alias',
      to: '/blog/a-note',
    })
  })

  it('treats an unknown single segment as a CMS page and longer paths as not found', () => {
    expect(resolveThemeRoute(['our-studio'], site)).toMatchObject({ kind: 'page', slug: 'our-studio' })
    expect(resolveThemeRoute(['our', 'studio'], site).kind).toBe('notFound')
  })

  it('decodes percent-encoded Persian slugs exactly once', () => {
    const encoded = encodeURIComponent('پروژه-ی-نور')
    expect(resolveThemeRoute(['projects', encoded], site)).toMatchObject({
      kind: 'project',
      slug: 'پروژه-ی-نور',
    })
  })

  it('reads pagination from the query string and ignores nonsense', () => {
    expect(resolveThemeRoute(['blog'], site, { page: '3' })).toMatchObject({ kind: 'blog', page: 3 })
    expect(resolveThemeRoute(['blog'], site, { page: '-2' })).toMatchObject({ kind: 'blog', page: 1 })
    expect(resolveThemeRoute(['blog'], site, { page: 'abc' })).toMatchObject({ kind: 'blog', page: 1 })
  })
})

describe('locale-aware route resolution for views', () => {
  it('keeps breadcrumb labels and parent links in the page locale', () => {
    const route = resolveLocaleRoute(['projects', 'casa'], 'en', site)
    expect(route).toMatchObject({ explicitLocale: true, kind: 'project', locale: 'en' })

    const crumbs = breadcrumbsFor(route, site, 'Casa')
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Home', 'Projects', 'Casa'])
    expect(crumbs[1]?.href).toBe('/en/projects')
  })

  it('adds no prefix for the default locale', () => {
    expect(resolveLocaleRoute(['blog'], 'fa', site)).toMatchObject({
      explicitLocale: false,
      kind: 'blog',
      locale: 'fa',
    })
  })
})

describe('URL builders', () => {
  it('prefixes only non-default locales', () => {
    expect(href('/projects', 'fa', site)).toBe('/projects')
    expect(href('/projects', 'en', site)).toBe('/en/projects')
  })

  it('encodes slugs and queries', () => {
    expect(projectPath('نور')).toBe('/projects/%D9%86%D9%88%D8%B1')
    expect(articlePath('a b')).toBe('/blog/a%20b')
    expect(categoryQuery('a&b')).toBe('?category=a%26b')
    expect(searchPath('نور سفید')).toBe('/search?q=%D9%86%D9%88%D8%B1%20%D8%B3%D9%81%DB%8C%D8%AF')
  })
})

describe('breadcrumbs', () => {
  it('always starts at home and marks the leaf aria-current', () => {
    const crumbs = breadcrumbsFor(resolveThemeRoute(['projects', 'x'], site), site, 'پروژه')
    expect(crumbs[0]?.label).toBe('خانه')
    expect(crumbs.at(-1)).toEqual({ current: true, label: 'پروژه' })
    expect(crumbs.length).toBe(3)
  })

  it('localises labels and prefixes URLs per locale', () => {
    const crumbs = breadcrumbsFor(resolveThemeRoute(['en', 'blog', 'x'], site), site, 'Note')
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Home', 'Notes', 'Note'])
    expect(crumbs[1]?.href).toBe('/en/blog')
  })

  it('does not create a second current crumb for an archive', () => {
    const crumbs = breadcrumbsFor(resolveThemeRoute(['education'], site), site)
    expect(crumbs.filter((crumb) => crumb.current)).toHaveLength(1)
  })
})
