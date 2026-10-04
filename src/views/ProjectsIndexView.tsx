import type { Metadata } from 'next'

import { ContentContainer } from '@/components/design/Container'
import { Pagination } from '@/components/design/Pagination'
import { SectionHeader } from '@/components/design/SectionHeader'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { EmptyState } from '@/components/states/States'
import { loadPageContext } from '@/lib/cms/pageContext'
import { getArchive, getSectionCategories } from '@/lib/cms/content'
import { postHref } from '@/lib/cms/content'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { projectsPath, THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { StateView } from '@/views/StateView'
import { InteriorPage } from '@/views/InteriorPage'
import type { Locale } from '@/lib/cms/types'
import { cn } from '@/lib/utils/cn'

/** Projects archive: breadcrumbs, modest title, category controls, framed mixed-ratio cards. */
export const projectsMetadata = async (locale: Locale, page: number, category?: string): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.projects)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const t = dictionary(locale)
  return metadataFor({
    context: outcome.ctx,
    description: null,
    noindex: page > 1 || Boolean(category),
    path: projectsPath(page),
    title: `${t.projects} — ${outcome.ctx.site.name}`,
  })
}

export const ProjectsIndexView = async ({
  category,
  locale,
  page,
}: {
  category?: null | string
  locale: Locale
  page: number
}) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.projects)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const [archive, section] = await Promise.all([
    getArchive(ctx, { categorySlug: category ?? null, page, section: 'projects' }),
    getSectionCategories('projects', ctx),
  ])

  const route = resolveLocaleRoute(['projects'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)
  // Filters, reset and pagination all build on the *localized* archive path, so an
  // English archive never sends a click back to the unprefixed Persian route.
  const basePath = href(THEME_ROUTES.projects, locale, ctx.site)

  return (
    <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.projects} label={t.breadcrumb} locale={locale}>
      <SectionHeader
        actions={
          section.children.length > 0 ? (
            <div className="filter-group">
              <span className="type-label me-2">{t.filterLabel}</span>
              <a aria-current={!category ? 'true' : undefined} className="filter-chip" href={basePath}>
                {t.allProjects}
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
        title={t.projects}
      />

      <ContentContainer>
        {archive.docs.length === 0 ? (
          <EmptyState locale={locale} />
        ) : (
          <>
            <h2 className="sr-only">{t.projects}</h2>
            <div className={cn('grid-projects')}>
              {await Promise.all(
                archive.docs.map(async (post) => (
                  <ProjectCard
                    context={ctx}
                    href={href(await postHref(post, ctx), locale, ctx.site)}
                    key={post.id}
                    post={post}
                  />
                )),
              )}
            </div>
            <Pagination
              basePath={basePath}
              currentPage={page}
              label={t.pagination}
              labels={{ next: t.next, previous: t.previous }}
              locale={locale}
              query={category ? `?category=${encodeURIComponent(category)}` : ''}
              totalPages={archive.totalPages}
            />
          </>
        )}
      </ContentContainer>
    </InteriorPage>
  )
}

export const projectsPageHref = projectsPath
