import type { Metadata } from 'next'

import { Blocks } from '@/components/blocks/Blocks'
import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import { CmsForm } from '@/components/forms/CmsForm'
import { getFormById } from '@/lib/cms/endpoints'
import { getSectionPage } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { BlockRow, Locale } from '@/lib/cms/types'
import { documentLanguages } from '@/lib/seo/translations'

/**
 * Contact — concise invitation, real details, and an optional compact CMS form. With a
 * form: two columns on desktop with a single fine divider between them; the divider is
 * dropped (not rotated) when the layout stacks on mobile. Without one: the details alone,
 * at full width — a form is not required and its absence is never announced.
 *
 * The form is whatever the CMS defines: the page's own `formBlock`, or the form bound
 * to the `contactForm` slot. The theme never substitutes its own field list.
 */
/**
 * Why the contact page has no form, for diagnostics and tests: no form configured at
 * all (neither a `formBlock` nor the `contactForm` binding), or a configured form the
 * CMS did not return in this locale (deleted, unpublished, untranslated or from
 * another site — the tenant-scoped read answers 404 for all of them).
 */
export type ContactFormReadiness = { form: 'form-ready' | 'form-unavailable' | 'form-unconfigured' }

export const contactFormReadiness = ({ form, formId }: { form: unknown; formId: null | string }): ContactFormReadiness => ({
  form: form ? 'form-ready' : formId ? 'form-unavailable' : 'form-unconfigured',
})

export const contactMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.contact)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const { page } = await getSectionPage('contact', outcome.ctx)
  return metadataFor({
    context: outcome.ctx,
    description: page?.meta?.description ?? null,
    image: page && isMedia(page.meta?.image) ? page.meta.image : null,
    languages: page
      ? await documentLanguages(outcome.ctx, { id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.contact })
      : undefined,
    path: THEME_ROUTES.contact,
    title: page?.title ?? dictionary(locale).contact,
  })
}

export const ContactView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.contact)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const { page } = await getSectionPage('contact', ctx)
  const route = resolveLocaleRoute(['contact'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)

  // The form comes from a `formBlock` on the page, else from the `contactForm` slot.
  const blockRows: BlockRow[] = page?.layout ?? []
  const formBlock = blockRows.find((row) => row.blockType === 'formBlock')
  const formBinding = ctx.site.themeRuntime?.bindings?.contactForm ?? null
  const formId =
    (formBlock && typeof formBlock.form === 'string' ? formBlock.form : (formBlock?.form as { id?: string } | null)?.id) ??
    formBinding?.id ??
    null
  const form = formId ? await getFormById(formId, locale, ctx.draft) : null
  const contactReadiness = contactFormReadiness({ formId, form })

  // Details come from `contact` blocks; the theme invents nothing.
  const detailBlocks = blockRows.filter((row) => row.blockType === 'contact')
  const otherBlocks = blockRows.filter((row) => row.blockType !== 'contact' && row.blockType !== 'formBlock')
  const details =
    detailBlocks.length > 0 ? (
      <Blocks blocks={detailBlocks} context={ctx} />
    ) : (
      <p className="type-body text-ink-secondary" data-contact-state="details-missing">
        {t.contactDetailsMissing}
      </p>
    )

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={THEME_ROUTES.contact}
      label={t.breadcrumb}
     
      switchDoc={page ? { id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.contact } : undefined}
    >
      <ContentContainer>
        <div className="relative">
          <DecorativeMark className="top-2 -start-1 hidden md:block" variant="crosshair" />
          <h1 className="type-title max-w-[24ch] ps-4 md:ps-6">{page?.title ?? t.contact}</h1>
          {page?.hero?.richText ? (
            <div className="mt-6 ps-4 md:ps-6">
              <RichText anchorScope="hero" content={page.hero.richText} context={ctx} fallbackDir={ctx.dir} />
            </div>
          ) : (
            <p className="type-lede mt-5 ps-4 md:ps-6">
              {t.contact}
            </p>
          )}
        </div>

        <Rule className="my-10" />

        {form ? (
          <div className="split split--even" data-contact-state={contactReadiness.form}>
            <div>{details}</div>
            <span aria-hidden="true" className="split__divider rule-v" />
            <div>
              <CmsForm form={form} locale={locale} />
            </div>
          </div>
        ) : (
          // No form is needed: without one the details take the full content width,
          // with no empty column, divider or "form unavailable" notice beside them.
          <div className="contact-solo" data-contact-state={contactReadiness.form}>
            {details}
          </div>
        )}
      </ContentContainer>

      {otherBlocks.length > 0 ? <Blocks blocks={otherBlocks} context={ctx} /> : null}
    </InteriorPage>
  )
}
