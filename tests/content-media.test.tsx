import { renderToReadableStream } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SiteContext } from '@/lib/cms/context'
import type { Locale, SiteDescriptor } from '@/lib/cms/types'

/**
 * CMS content images render **once**, where the editor put them, and every one of
 * them is a trigger of the field's single lightbox: `upload` nodes, the inline
 * `mediaBlock`, every cell of a `mediaGrid`. The project page therefore has no second
 * auto-generated gallery of the same media below the narrative.
 *
 * Rendered with React's own server renderer (the views are async server
 * components); Next's request APIs are stubbed and the CMS is the fixture encoder.
 */

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  draftMode: async () => ({ isEnabled: false }),
  headers: async () => new Headers({ host: 'example.test', 'x-forwarded-proto': 'https' }),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`)
  },
  usePathname: () => '/',
}))

const ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ENV, ESHOBE_DEV_FIXTURES: '1', ESHOBE_PUBLIC_ORIGIN: 'https://example.test' }
  delete process.env.ESHOBE_CMS_URL
})

afterEach(() => {
  process.env = { ...ENV }
})

const html = async (element: React.ReactElement): Promise<string> => {
  const stream = await renderToReadableStream(element)
  await stream.allReady
  return new Response(stream).text()
}

const count = (markup: string, needle: RegExp): number => (markup.match(needle) ?? []).length

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

const picture = (file: string, width = 1600, height = 1067) => ({
  alt: `تصویر ${file}`,
  height,
  id: `media-${file}`,
  mimeType: 'image/jpeg',
  url: `/qa/media/${file}`,
  width,
})

const text = (value: string) => ({ children: [{ text: value, type: 'text', version: 1 }], type: 'paragraph', version: 1 })
const upload = (value: unknown) => ({ children: [], fields: {}, relationTo: 'media', type: 'upload', value, version: 1 })
const block = (fields: Record<string, unknown>) => ({ fields, type: 'block', version: 1 })

describe('rich text media', () => {
  it('renders every content image once, each as a trigger of one lightbox, in document order', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = {
      root: {
        children: [
          text('متن آغازین'),
          upload(picture('one.jpg')),
          block({ blockType: 'mediaGrid', columns: '2', images: [picture('two.jpg', 1000, 1500), picture('three.jpg')] }),
          text('متن میانی'),
          block({ blockType: 'mediaBlock', caption: 'زیرنویس', media: picture('four.jpg') }),
          upload(picture('five.jpg')),
        ],
        direction: 'rtl' as const,
      },
    }
    const markup = await html(<RichText content={content} context={ctx('fa')} fallbackDir="rtl" />)

    // Five photographs → five triggers, indexed 0…4 in reading order, and five images.
    expect(count(markup, /class="lightbox-trigger/gu)).toBe(5)
    expect([...markup.matchAll(/data-lightbox-index="(\d)"/gu)].map((match) => match[1])).toEqual(['0', '1', '2', '3', '4'])
    for (const file of ['one', 'two', 'three', 'four', 'five']) {
      expect(count(markup, new RegExp(`src="https://example.test/qa/media/${file}.jpg"`, 'gu'))).toBe(1)
    }

    // The inline grid is the shared 2/2/3 media grid with the editor's desktop choice,
    // not a private list class of its own.
    expect(markup).toContain('class="grid-media grid-media--2"')
    expect(markup).not.toContain('media-grid__list')
    // The lightbox itself is closed: no dialog markup is sent with the page.
    expect(markup).not.toContain('role="dialog"')
    expect(markup).not.toContain('lightbox__overlay')
  })

  it('leaves prose without photographs free of any lightbox trigger', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const markup = await html(
      <RichText content={{ root: { children: [text('فقط متن')], direction: 'rtl' as const } }} context={ctx('fa')} fallbackDir="rtl" />,
    )
    expect(markup).not.toContain('lightbox-trigger')
    expect(markup).toContain('فقط متن')
  })

  it('keeps an image whose file did not resolve as a plain, non-interactive frame', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = {
      root: {
        children: [upload({ ...picture('one.jpg'), url: undefined }), upload(picture('two.jpg'))],
        direction: 'rtl' as const,
      },
    }
    const markup = await html(<RichText content={content} context={ctx('fa')} fallbackDir="rtl" />)
    expect(count(markup, /class="lightbox-trigger/gu)).toBe(1)
    expect(markup).toContain('data-lightbox-index="0"')
    expect(markup).toContain('src="https://example.test/qa/media/two.jpg"')
  })
})

describe('project detail page', () => {
  it('renders the content photographs once — no second gallery built from the same media', async () => {
    const { ProjectDetailView } = await import('@/views/ProjectDetailView')
    const { FIXTURE_POSTS } = await import('@/lib/cms/fixtures.data')
    const project = FIXTURE_POSTS.find((post) => post.slug === 'khaneye-noor')!
    const hero = project.heroImage as { url: string }

    const markup = await html(await ProjectDetailView({ locale: 'fa', slug: 'khaneye-noor' }))

    // The hero is composition and stays; the same file appears once more inside the
    // narrative as the editor's upload — and nowhere else.
    const url = `https://example.test${hero.url}`
    expect(count(markup, new RegExp(`src="${url.replace(/[./]/gu, '\\$&')}"`, 'gu'))).toBe(2)
    expect(count(markup, /class="lightbox-trigger/gu)).toBe(1)
    expect(count(markup, /class="grid-media/gu)).toBe(0)
    expect(markup).not.toContain('>تصاویر<')
    // The facts block is the compact drafting block, built only from real fields.
    expect(markup).toContain('class="facts"')
    expect(markup).not.toContain('md:grid-cols-3')
  })
})
