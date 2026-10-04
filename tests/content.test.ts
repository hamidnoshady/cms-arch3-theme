import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPageBySlug, getPostById, getPostBySlug, searchPosts } from '@/lib/cms/endpoints'
import { getArchive, getSectionCategories, searchHrefs } from '@/lib/cms/content'
import { FIXTURE_POSTS } from '@/lib/cms/fixtures.data'
import { navLinks } from '@/lib/routing/nav'
import type { SiteContext } from '@/lib/cms/context'
import type { Locale, SiteDescriptor } from '@/lib/cms/types'

/**
 * Resolution rules that a plausible-looking implementation still gets wrong:
 *
 *  - a `posts` nav reference carries a document **id**, not a slug;
 *  - a document read must be single-locale with field fallback **off**, so the CMS can
 *    never answer with a different locale's values for the same slug;
 *  - a menu item with no resolvable target disappears instead of pointing somewhere
 *    plausible and wrong.
 *
 * The first group runs against the fixture encoder (the same code the mock CMS serves
 * and the browser evidence is captured against); the second runs against a fetch stub,
 * because it is about the request the theme *sends*.
 */

const ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ENV, ESHOBE_DEV_FIXTURES: '1' }
  delete process.env.ESHOBE_CMS_URL
})

afterEach(() => {
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

const ctx = (locale: Locale): SiteContext =>
  ({
    canonicalOrigin: 'https://example.test',
    deploymentOrigin: 'https://example.test',
    dir: locale === 'fa' ? 'rtl' : 'ltr',
    draft: false,
    locale,
    serving: true,
    site: {
      availableLocales: ['fa', 'en'] as Locale[],
      defaultLocale: 'fa' as Locale,
      id: 'site-fixture',
      locales: ['fa', 'en'] as Locale[],
      media: { origin: 'https://example.test' },
      name: 'استودیوی نمونه',
      themeRuntime: { bindings: {}, settings: {} },
    } as unknown as SiteDescriptor,
  }) satisfies SiteContext

const reference = (relationTo: 'pages' | 'posts', value: string) => ({
  id: `nav-${value}`,
  link: { label: 'برچسب', reference: { relationTo, value }, type: 'reference' as const },
})

describe('nav link resolution', () => {
  it('resolves a `posts` reference by document id, not by slug', async () => {
    const post = FIXTURE_POSTS.find((entry) => entry.id === 'post-n1')
    expect(post).toBeDefined()
    // The fixture id and slug deliberately differ: passing the id to a slug lookup
    // would drop this menu item, which is exactly the bug this test pins.
    expect(post!.id).not.toBe(post!.slug)

    const links = await navLinks([reference('posts', post!.id)] as never, ctx('fa'), '/')
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ external: false, href: `/blog/${post!.slug}` })
  })

  it('prefixes the English tree for a resolved reference', async () => {
    const links = await navLinks([reference('posts', 'post-n1')] as never, ctx('en'), '/en')
    expect(links[0]?.href.startsWith('/en/blog/')).toBe(true)
  })

  it('drops a reference whose document does not resolve instead of guessing a target', async () => {
    const links = await navLinks([reference('posts', 'post-does-not-exist')] as never, ctx('fa'), '/')
    expect(links).toEqual([])
  })

  it('keeps a custom URL and marks the current page', async () => {
    const item = { id: 'nav-x', link: { label: 'پروژه‌ها', type: 'custom' as const, url: '/projects' } }
    const links = await navLinks([item] as never, ctx('fa'), '/projects')
    expect(links[0]).toMatchObject({ current: true, href: '/projects' })
  })
})

describe('document reads are single-locale', () => {
  const calls: string[] = []

  const stubFetch = (body: unknown): void => {
    calls.length = 0
    vi.stubGlobal('fetch', async (input: string | URL) => {
      calls.push(String(input))
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      })
    })
  }

  const queryOf = (url: string): URLSearchParams => new URL(url).searchParams

  beforeEach(() => {
    // Turn the fixture provider off so the real request path runs instead.
    process.env = { ...ENV, ESHOBE_API_KEY: 'site-key-for-test', ESHOBE_CMS_URL: 'https://cms.example.test' }
    delete process.env.ESHOBE_DEV_FIXTURES
  })

  it('asks for one locale with field fallback off, and never an invented endpoint', async () => {
    stubFetch({ docs: [] })
    await getPostBySlug('notes-on-lines', 'en', false)

    expect(calls).toHaveLength(1)
    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/api/posts')
    expect(queryOf(calls[0]!).get('locale')).toBe('en')
    expect(queryOf(calls[0]!).get('fallbackLocale')).toBe('false')
    expect(queryOf(calls[0]!).get('where[and][0][slug][equals]')).toBe('notes-on-lines')
    // Published-only is the theme's own filter, because a site key can read drafts.
    expect(queryOf(calls[0]!).get('where[and][1][_status][equals]')).toBe('published')
  })

  it('reads a post by id through the documented list query', async () => {
    stubFetch({ docs: [] })
    await expect(getPostById('post-n1', 'fa', false)).resolves.toBeNull()

    const params = queryOf(calls[0]!)
    expect(new URL(calls[0]!).pathname).toBe('/api/posts')
    expect(params.get('where[and][0][id][equals]')).toBe('post-n1')
    expect(params.get('locale')).toBe('fa')
    expect(params.get('fallbackLocale')).toBe('false')
  })

  it('keeps a slug lookup scoped to the requested locale', async () => {
    stubFetch({ docs: [] })
    await getPageBySlug('about', 'en', false)

    const params = queryOf(calls[0]!)
    expect(new URL(calls[0]!).pathname).toBe('/api/pages')
    expect(params.get('where[and][0][slug][equals]')).toBe('about')
    expect(params.get('locale')).toBe('en')
    expect(params.get('fallbackLocale')).toBe('false')
  })

  it('never filters the search index by _status — the index has no such field', async () => {
    // The live CMS answers a `_status` filter on `/api/search` with a 400 QueryError,
    // which surfaced as the whole search page falling into the error boundary. The index
    // holds published documents only, so the theme must not add the filter at all.
    stubFetch({ docs: [] })
    await searchPosts('نور', 'fa')

    const params = queryOf(calls[0]!)
    expect(new URL(calls[0]!).pathname).toBe('/api/search')
    expect(params.get('where[and][0][title][like]')).toBe('نور')
    expect(params.get('where[and][1][_status][equals]')).toBeNull()
  })

  it('sends the site credential in a header, never in the URL', async () => {
    const seen: Record<string, string> = {}
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      Object.assign(seen, (init?.headers ?? {}) as Record<string, string>)
      return new Response(JSON.stringify({ docs: [] }), { headers: { 'content-type': 'application/json' }, status: 200 })
    })
    await getPageBySlug('about', 'fa', false)

    expect(seen.authorization).toBe('Bearer site-key-for-test')
    expect(String(seen.authorization)).not.toContain('about')
  })

  it('treats a 404 document read as missing rather than as a failure', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"errors":[{"message":"not found"}]}', { headers: { 'content-type': 'application/json' }, status: 404 }))
    await expect(getPostBySlug('missing', 'fa', false)).resolves.toBeNull()
  })
})

describe('archive scoping and search destinations', () => {
  it('rejects a category from another section instead of crossing sections', async () => {
    // `workshops` lives under education; asking for it on the projects archive must
    // yield the empty state, never education entries rendered as project cards.
    const crossed = await getArchive(ctx('fa'), { categorySlug: 'workshops', section: 'projects' })
    expect(crossed.docs).toEqual([])
    expect(crossed.totalDocs).toBe(0)

    // The archive's own categories still filter normally.
    const residential = await getArchive(ctx('fa'), { categorySlug: 'residential', section: 'projects' })
    expect(residential.docs.length).toBeGreaterThan(0)
    expect(
      residential.docs.every((post) => (post.categories ?? []).includes('cat-residential')),
    ).toBe(true)
  })

  it('scopes blog filters to the blog and rejects project/education categories', async () => {
    await expect(getArchive(ctx('fa'), { categorySlug: 'residential', section: 'blog' })).resolves.toMatchObject({
      docs: [],
      totalDocs: 0,
    })
    const notes = await getArchive(ctx('fa'), { categorySlug: 'notes', section: 'blog' })
    expect(notes.docs.length).toBeGreaterThan(0)
    expect(notes.totalDocs).toBe(notes.docs.length)
  })

  it('offers the unbound blog its real top-level categories, not an always-empty list', async () => {
    const section = await getSectionCategories('blog', ctx('fa'))
    expect(section.root).toBeNull()
    expect(section.children.map((child) => child.slug)).toEqual(['notes'])
    expect(section.excludedIds).toEqual(expect.arrayContaining(['cat-residential', 'cat-workshops']))
  })

  it('resolves each search hit to the section that owns the document', async () => {
    const educationHits = await searchPosts('نور', 'fa')
    const educationHrefs = await searchHrefs(educationHits, ctx('fa'))
    expect([...educationHrefs.values()]).toContain('/education/workshop-light')

    const projectHits = await searchPosts('دبستان', 'fa')
    const projectHrefs = await searchHrefs(projectHits, ctx('fa'))
    expect([...projectHrefs.values()]).toContain('/projects/madrese-e-aban')
  })
})

describe('language switch targets', () => {
  it('carries a locale-neutral search term into the other locale', async () => {
    const { switchTargetsForPath } = await import('@/lib/seo/translations')
    // Callers hand in an already-encoded query, the same way `categoryQuery()` and
    // `pageQueryParam()` do, so the value is never encoded twice.
    const targets = switchTargetsForPath(ctx('fa'), () => '/search', `?q=${encodeURIComponent('نور')}`)
    const english = targets.find((target) => target.locale === 'en')
    expect(english?.href).toBe('/en/search?q=%D9%86%D9%88%D8%B1')
  })

  it('builds the home switch from a locale-neutral path, never a prefixed one', async () => {
    // The bug this guards: passing `href('/', locale, site)` inside the closure applied
    // the prefix twice, so the English home offered `/en/en` and pointed "فارسی" at `/en`.
    const { switchTargetsForPath } = await import('@/lib/seo/translations')
    for (const from of ['fa', 'en'] as Locale[]) {
      const targets = switchTargetsForPath(ctx(from), () => '/')
      expect(targets.find((target) => target.locale === 'fa')?.href).toBe('/')
      expect(targets.find((target) => target.locale === 'en')?.href).toBe('/en')
    }
  })

  it('switches an interior path in both directions', async () => {
    const { switchTargetsForPath } = await import('@/lib/seo/translations')
    const targets = switchTargetsForPath(ctx('en'), () => '/projects')
    expect(targets.map((target) => target.href).sort()).toEqual(['/en/projects', '/projects'])
  })

  it('keeps the default locale unprefixed and adds no empty query', async () => {
    const { switchTargetsForPath } = await import('@/lib/seo/translations')
    const targets = switchTargetsForPath(ctx('en'), () => '/projects')
    expect(targets.find((target) => target.locale === 'fa')?.href).toBe('/projects')
  })
})
