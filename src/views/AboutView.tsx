import type { Metadata } from 'next'

import { Blocks } from '@/components/blocks/Blocks'
import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import { CmsImage } from '@/components/media/CmsImage'
import { EmptyState } from '@/components/states/States'
import { getSectionPage } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { collectMedia } from '@/lib/utils/lexical'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'
import type { Media } from '@/lib/cms/types'

/**
 * About — sparse by design: breadcrumbs, a modest title, one short introduction, one
 * small studio image (~42% of desktop content width) with its inset frame, one discreet
 * contact link, and a lot of white space.
 *
 * CMS blocks are still rendered *after* that composition when the page really has them —
 * the sparse default never deletes a customer's content to look like a sample.
 */
export const aboutMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.about)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const { page } = await getSectionPage('about', outcome.ctx)
  return metadataFor({
    context: outcome.ctx,
    description: page?.meta?.description ?? null,
    image: page && isMedia(page.meta?.image) ? page.meta.image : null,
    path: THEME_ROUTES.about,
    title: page?.title ?? dictionary(locale).about,
  })
}

export const AboutView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.about)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const { page } = await getSectionPage('about', ctx)
  const route = resolveLocaleRoute(['about'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)

  if (!page) {
    return (
      <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.about} label={t.breadcrumb} locale={locale}>
        <ContentContainer>
          <EmptyState locale={locale} />
        </ContentContainer>
      </InteriorPage>
    )
  }

  const heroMedia = isMedia(page.hero?.media) ? page.hero.media : null
  const inlineMedia = (collectMedia(page.hero?.richText as never)[0] ?? null) as Media | null
  const image = heroMedia ?? inlineMedia

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={THEME_ROUTES.about}
      label={t.breadcrumb}
      locale={locale}
      switchDoc={{ id: page.id, kind: 'page', pathForLocale: () => THEME_ROUTES.about }}
    >
      <ContentContainer>
        <div className="relative">
          <DecorativeMark className="top-2 -start-1 hidden md:block" variant="offset-l" />
          <h1 className="type-title max-w-[24ch] ps-4 md:ps-6">{page.title}</h1>
        </div>
        <Rule className="my-10" />

        <div className="about-composition">
          <div className="min-w-0">
            {page.hero?.richText ? (
              <RichText content={page.hero.richText} context={ctx} fallbackDir={ctx.dir} />
            ) : (
              <p className="type-lede">
                {page.meta?.description ?? ''}
              </p>
            )}
            <p className="mt-10">
              <a className="link-inline type-ui target-standalone" href={href(THEME_ROUTES.contact, locale, ctx.site)}>
                {t.contact}
              </a>
            </p>
          </div>

          <div className="relative">
            {image ? (
              <span className="frame block" style={{ aspectRatio: image.width && image.height ? `${image.width} / ${image.height}` : '4 / 5' }}>
                <CmsImage
                  className="frame__media"
                  media={image}
                  origin={ctx.site.media.origin}
                  sizes="(min-width: 1024px) 42vw, 100vw"
                />
                <DecorativeMark className="bottom-1 end-1 hidden md:block" variant="corner" />
              </span>
            ) : (
              <span aria-hidden="true" className="skeleton block" style={{ aspectRatio: '4 / 5' }} />
            )}
          </div>
        </div>
      </ContentContainer>

      {page.layout && page.layout.length > 0 ? <Blocks blocks={page.layout} context={ctx} /> : null}
    </InteriorPage>
  )
}
