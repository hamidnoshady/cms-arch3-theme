import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { ContentContainer } from '@/components/design/Container'
import { RichText } from '@/components/blocks/RichText'
import { FramedMedia } from '@/components/media/CmsImage'
import { ProjectCard, ProjectFacts } from '@/components/projects/ProjectCard'
import { loadPageContext } from '@/lib/cms/pageContext'
import { getPostContext, postHref } from '@/lib/cms/content'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { projectPath } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'

/**
 * Project detail: breadcrumbs, title, **real** facts only, controlled hero ratio,
 * the rich-text narrative and related projects.
 *
 * The facts block renders solely from `posts.projectMetadata` fields the CMS returned.
 * There is no fallback that guesses a location or a year from the prose.
 *
 * The photographs of a project are the ones the editor placed in `content`, rendered
 * **once** by `<RichText>` — each as a trigger of the field's shared lightbox, with
 * previous/next across all of them. The view deliberately does not collect the same
 * media again into a second "Gallery" section below the narrative: that duplicated
 * every image. A separate gallery is only warranted by a separate CMS source (a
 * dedicated project-gallery field), which the contract does not have today.
 */
export const projectMetadata = async (locale: Locale, slug: string): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, projectPath(slug))
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const data = await getPostContext(slug, outcome.ctx)
  if (!data) return { robots: { follow: false, index: false }, title: undefined }
  const { post } = data
  return metadataFor({
    context: outcome.ctx,
    description: post.meta?.description ?? null,
    image: isMedia(post.meta?.image) ? post.meta.image : isMedia(post.heroImage) ? post.heroImage : null,
    path: projectPath(slug),
    title: post.title,
    type: 'article',
  })
}

export const ProjectDetailView = async ({ locale, slug }: { locale: Locale; slug: string }) => {
  const outcome = await loadPageContext(locale, projectPath(slug))
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const data = await getPostContext(slug, ctx)
  if (!data) notFound()
  const { post, related } = data
  const t = dictionary(locale)

  // A note reached through `/projects/<slug>` is not a project; send it to the section
  // that owns it rather than rendering the project composition around it. Preview keeps
  // the requested URL for editors.
  if (!ctx.draft && data.section !== 'projects') {
    redirect(href(await postHref(post, ctx), locale, ctx.site))
  }

  const hero = isMedia(post.heroImage) ? post.heroImage : null

  const route = resolveLocaleRoute(['projects', slug], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site, post.title)

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={projectPath(slug)}
      label={t.breadcrumb}
      locale={locale}
      switchDoc={{ id: post.id, kind: 'post', pathForLocale: () => projectPath(slug) }}
    >
      <ContentContainer>
        <header className="project-head">
          <div>
            <h1 className="type-title max-w-[24ch]">{post.title}</h1>
            <ProjectFacts context={ctx} post={post} />
          </div>
          {hero ? <FramedMedia cap={78} media={hero} origin={ctx.site.media.origin} priority size="wide" /> : null}
        </header>
      </ContentContainer>

      <ContentContainer className="mt-12">
        <div className="project-narrative">
          <RichText content={post.content as never} context={ctx} fallbackDir={ctx.dir} />
        </div>
      </ContentContainer>

      {related.length > 0 ? (
        <ContentContainer>
          <section aria-labelledby="related-projects" className="project-related">
            <h2 className="type-heading mb-6" id="related-projects">
              {t.relatedProjects}
            </h2>
            <div className="grid-projects">
              {await Promise.all(
                related.map(async (entry) => (
                  <ProjectCard
                    context={ctx}
                    href={href(await postHref(entry, ctx), locale, ctx.site)}
                    key={entry.id}
                    post={entry}
                  />
                )),
              )}
            </div>
          </section>
        </ContentContainer>
      ) : null}
    </InteriorPage>
  )
}
