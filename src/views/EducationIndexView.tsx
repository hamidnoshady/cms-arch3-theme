import type { Metadata } from 'next'

import { ContentContainer } from '@/components/design/Container'
import { Pagination } from '@/components/design/Pagination'
import { Rule } from '@/components/design/Rule'
import { SectionHeader } from '@/components/design/SectionHeader'
import { EducationFeatured, EducationRow } from '@/components/education/EducationRows'
import { EmptyState } from '@/components/states/States'
import { getArchive, getSectionCategories, postHref } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { educationPath, THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { lexicalText } from '@/lib/utils/lexical'
import { readingMinutes } from '@/lib/utils/text'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'

/**
 * Education archive: one restrained featured entry, then compact horizontal rows with
 * a small 5px-inset thumbnail. Reading time is computed from the entry's own copy; the
 * contract has no duration field, so no duration is invented.
 */
export const educationMetadata = async (locale: Locale, page: number, category?: string): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.education)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const t = dictionary(locale)
  return metadataFor({
    context: outcome.ctx,
    noindex: page > 1 || Boolean(category),
    path: educationPath(page),
    title: `${t.education} — ${outcome.ctx.site.name}`,
  })
}

export const EducationIndexView = async ({
  category,
  locale,
  page,
}: {
  category?: null | string
  locale: Locale
  page: number
}) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.education)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)

  const [archive, section] = await Promise.all([
    getArchive(ctx, { categorySlug: category ?? null, limit: 13, page, section: 'education' }),
    getSectionCategories('education', ctx),
  ])

  const [featured, ...rest] = archive.docs
  const route = resolveLocaleRoute(['education'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)
  // Localized once: filters, reset and pagination share it, so English stays under /en.
  const basePath = href(THEME_ROUTES.education, locale, ctx.site)

  return (
    <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.education} label={t.breadcrumb} locale={locale}>
      <SectionHeader
        actions={
          section.children.length > 0 ? (
            <div className="filter-group">
              <span className="type-label me-2">{t.filterLabel}</span>
              <a aria-current={!category ? 'true' : undefined} className="filter-chip" href={basePath}>
                {t.education}
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
        lede={null}
        title={t.education}
      />

      <ContentContainer>
        {!featured ? (
          <EmptyState locale={locale} />
        ) : (
          <>
            <EducationFeatured
              category={categoryTitle(featured, section.children)}
              context={ctx}
              href={href(await postHref(featured, ctx), locale, ctx.site)}
              minutes={readingMinutes(lexicalText(featured.content as never))}
              post={featured}
            />
            {rest.length > 0 ? (
              <>
                <Rule className="mt-10" />
                <ul className="mt-2">
                  {await Promise.all(
                    rest.map(async (post) => (
                      <EducationRow
                        category={categoryTitle(post, section.children)}
                        context={ctx}
                        href={href(await postHref(post, ctx), locale, ctx.site)}
                        key={post.id}
                        minutes={readingMinutes(lexicalText(post.content as never))}
                        post={post}
                      />
                    )),
                  )}
                </ul>
              </>
            ) : null}
          </>
        )}
      </ContentContainer>

      <ContentContainer>
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
    </InteriorPage>
  )
}

const categoryTitle = (
  post: { categories?: ({ id: string; title?: string } | string)[] | null },
  children: { id: string; title: string }[],
): null | string => {
  const ids = (post.categories ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.id))
  const match = children.find((child) => ids.includes(child.id))
  return match?.title ?? null
}
