import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import { CmsImage } from '@/components/media/CmsImage'
import { authorLine } from '@/components/blog/PostRows'
import { getPostContext, postHref } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import { dateText } from '@/lib/utils/dates'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { articlePath, educationEntryPath } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { lexicalText } from '@/lib/utils/lexical'
import { isMedia } from '@/lib/utils/media'
import { readingMinutes, readingTimeLabel } from '@/lib/utils/text'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'

/**
 * Article / education-entry detail: comfortable prose measure inside the 1440px
 * container, real metadata (date, public author names, computed reading time),
 * rich text with embedded media, and an optional related list.
 */
const load = async (locale: Locale, kind: 'article' | 'educationEntry', slug: string) => {
  const canonical = kind === 'article' ? articlePath(slug) : educationEntryPath(slug)
  const outcome = await loadPageContext(locale, canonical)
  if (!outcome.ok) return { outcome, data: null as null, canonical }
  const data = await getPostContext(slug, outcome.ctx)
  return { canonical, data, outcome }
}

export const articleMetadata = async (locale: Locale, kind: 'article' | 'educationEntry', slug: string): Promise<Metadata> => {
  const { canonical, data, outcome } = await load(locale, kind, slug)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  if (!data) return { robots: { follow: false, index: false } }
  const post = data.post
  return metadataFor({
    context: outcome.ctx,
    description: post.meta?.description ?? null,
    image: isMedia(post.meta?.image) ? post.meta.image : isMedia(post.heroImage) ? post.heroImage : null,
    path: canonical,
    title: post.title,
    type: 'article',
  })
}

export const ArticleView = async ({
  kind,
  locale,
  slug,
}: {
  kind: 'article' | 'educationEntry'
  locale: Locale
  slug: string
}) => {
  const { canonical, data, outcome } = await load(locale, kind, slug)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  if (!data) notFound()
  const ctx = outcome.ctx
  const { post, related, siblings } = data
  const t = dictionary(locale)

  // One document, one canonical URL: a note opened through `/education/<slug>` (or a
  // workshop through `/blog/<slug>`) moves to the section that owns it instead of
  // rendering a second, differently-composed version of the same document. Preview
  // keeps the requested URL so an editor can still open the draft in place.
  const expectedSection = kind === 'article' ? 'blog' : 'education'
  if (!ctx.draft && data.section !== expectedSection) {
    redirect(href(await postHref(post, ctx), locale, ctx.site))
  }

  const hero = isMedia(post.heroImage) ? post.heroImage : null
  const author = authorLine(post)
  const minutes = readingMinutes(lexicalText(post.content as never))
  const route = resolveLocaleRoute(kind === 'article' ? ['blog', slug] : ['education', slug], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site, post.title)

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={canonical}
      label={t.breadcrumb}
      locale={locale}
      switchDoc={{ id: post.id, kind: 'post', pathForLocale: () => canonical }}
    >
      <ContentContainer>
        <article>
          <header className="relative max-w-[52rem]">
            <DecorativeMark className="top-2 -start-1 hidden md:block" variant="crosshair" />
            <h1 className="type-title max-w-[30ch] ps-4 md:ps-6">{post.title}</h1>
            <p className="type-meta mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 ps-4 md:ps-6">
              {author ? <span>{author}</span> : null}
              {dateText(post.publishedAt, locale) ? <span>{dateText(post.publishedAt, locale)}</span> : null}
              {minutes > 0 ? <span>{readingTimeLabel(minutes, locale)}</span> : null}
              {siblings.map((category) => (
                <span key={category.id}>{category.title}</span>
              ))}
            </p>
          </header>

          {hero ? (
            <div className="frame mt-8" style={{ aspectRatio: hero.width && hero.height ? `${hero.width} / ${hero.height}` : '3 / 2' }}>
              <CmsImage className="frame__media" media={hero} origin={ctx.site.media.origin} priority sizes="(min-width: 1024px) 60vw, 100vw" />
            </div>
          ) : null}

          <div className="mt-10">
            <RichText content={post.content as never} context={ctx} fallbackDir={ctx.dir} />
          </div>
        </article>
      </ContentContainer>

      {related.length > 0 ? (
        <ContentContainer className="pb-16 pt-12">
          <Rule className="mb-8" />
          <h2 className="type-heading mb-6">{kind === 'article' ? t.relatedEntries : t.relatedEntries}</h2>
          <ul className="grid gap-6 md:grid-cols-3">
            {await Promise.all(
              related.map(async (entry) => (
                <li className="border-t border-line-structural pt-4" key={entry.id}>
                  <a className="link-inline type-ui target-standalone" href={href(await postHref(entry, ctx), locale, ctx.site)}>
                    {entry.title}
                  </a>
                </li>
              )),
            )}
          </ul>
        </ContentContainer>
      ) : null}
    </InteriorPage>
  )
}
