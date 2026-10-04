import type { Metadata } from 'next'

import { ContentContainer } from '@/components/design/Container'
import { Rule } from '@/components/design/Rule'
import { SectionHeader } from '@/components/design/SectionHeader'
import { ArticleRow, LatestNote, LeadStory } from '@/components/blog/PostRows'
import { Pagination } from '@/components/design/Pagination'
import { EmptyState } from '@/components/states/States'
import { getArchive, getSectionCategories, postHref } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { blogPath, THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { lexicalText } from '@/lib/utils/lexical'
import { readingMinutes } from '@/lib/utils/text'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'

/**
 * Blog index — text-led, structurally different from Projects and Education:
 * a lead story, a "latest notes" column divided from it by a fine vertical rule, then
 * article rows with small thumbnails and hairline separators.
 */
export const blogMetadata = async (locale: Locale, page: number, category?: null | string): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.blog)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const t = dictionary(locale)
  return metadataFor({
    context: outcome.ctx,
    noindex: page > 1 || Boolean(category),
    path: blogPath(page),
    title: `${t.blog} — ${outcome.ctx.site.name}`,
  })
}

export const BlogIndexView = async ({
  category,
  locale,
  page,
}: {
  category?: null | string
  locale: Locale
  page: number
}) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.blog)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)

  const [archive, section] = await Promise.all([
    getArchive(ctx, { categorySlug: category ?? null, limit: 13, page, section: 'blog' }),
    getSectionCategories('blog', ctx),
  ])
  const [lead, ...others] = archive.docs
  const latest = others.slice(0, 4)
  const rows = others.slice(4)
  const route = resolveLocaleRoute(['blog'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)
  // One localized base for filters, reset and pagination (English stays under /en).
  const basePath = href(THEME_ROUTES.blog, locale, ctx.site)

  // One href map for the whole page: a post's URL depends on the section it belongs to,
  // so resolving it per list item with a second rule can only ever disagree with itself
  // (the lead story and the rows below it are the same archive).
  const hrefById = new Map(
    await Promise.all(archive.docs.map(async (post) => [post.id, href(await postHref(post, ctx), locale, ctx.site)] as const)),
  )
  const hrefFor = (post: { id: string }): string => hrefById.get(post.id) ?? basePath

  return (
    <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.blog} label={t.breadcrumb} locale={locale}>
      <SectionHeader
        actions={
          section.children.length > 0 ? (
            <div className="filter-group">
              <span className="type-label me-2">{t.filterLabel}</span>
              <a aria-current={!category ? 'true' : undefined} className="filter-chip" href={basePath}>
                {t.blog}
              </a>
              {section.children.map((child) => (
                <a
                  aria-current={category === child.slug ? 'true' : undefined}
                  className="filter-chip"
                  href={`${basePath}?category=${encodeURIComponent(child.slug)}`}
                  key={child.id}
                >
                  {child.title}
                </a>
              ))}
            </div>
          ) : null
        }
        mark="pair"
        title={t.blog}
      />

      {!lead ? (
        <ContentContainer>
          <EmptyState locale={locale} />
        </ContentContainer>
      ) : (
        <ContentContainer>
          <div className="split">
            <div>
              <LeadStory
                category={null}
                context={ctx}
                href={hrefFor(lead)}
                minutes={readingMinutes(lexicalText(lead.content as never))}
                post={lead}
              />
            </div>
            <span aria-hidden="true" className="split__divider rule-v" />
            <div>
              <h2 className="type-label mb-2">{t.latestNotes}</h2>
              <ul>
                {latest.map((post) => (
                  <LatestNote context={ctx} href={hrefFor(post)} key={post.id} post={post} />
                ))}
              </ul>
            </div>
          </div>

          {rows.length > 0 ? (
            <>
              <Rule className="mt-12" />
              <ul className="mt-2">
                {rows.map((post) => (
                  <ArticleRow
                    category={null}
                    context={ctx}
                    href={hrefFor(post)}
                    key={post.id}
                    minutes={readingMinutes(lexicalText(post.content as never))}
                    post={post}
                  />
                ))}
              </ul>
            </>
          ) : null}

          <Pagination
            basePath={basePath}
            currentPage={page}
            label={t.pagination}
            labels={{ next: t.next, previous: t.previous }}
            locale={locale}
            query={category ? `?category=${encodeURIComponent(category)}` : ''}
            totalPages={archive.totalPages}
          />
        </ContentContainer>
      )}
    </InteriorPage>
  )
}
