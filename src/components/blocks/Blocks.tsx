import Link from 'next/link'
import type { ReactNode } from 'react'

import { ContentContainer } from '@/components/design/Container'
import { DecorativeMark, type MarkVariant } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import { Type } from '@/components/design/Type'
import { CmsForm } from '@/components/forms/CmsForm'
import { CmsImage } from '@/components/media/CmsImage'
import { Gallery, type GalleryItem } from '@/components/media/Gallery'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import type { SiteContext } from '@/lib/cms/context'
import { getFormById, getPosts, getPostsByIds } from '@/lib/cms/endpoints'
import type { BlockRow, CmsLink, FormDoc, Media, PostDoc } from '@/lib/cms/types'
import { formatNumber, toLocaleDigits } from '@/lib/runtime'
import { postHref } from '@/lib/cms/content'
import { cn } from '@/lib/utils/cn'
import { dateText } from '@/lib/utils/dates'
import { isMedia, mediaSrcSet, mediaUrl } from '@/lib/utils/media'
import { labels as dictionary } from '@/lib/theme/labels'
import { warnUnknown } from './node'
import { RichText } from './RichText'

/**
 * Page-layout block registry.
 *
 * Rules applied to every block:
 * - The page renders only blocks the **site's own allowlist** permits; anything else
 *   is skipped with a diagnostic (`warnUnknown`), never a crash.
 * - Block order and ids come from the CMS row order; nothing is re-sorted.
 * - Rich text is rendered through `<RichText>`, which keeps each field's own direction.
 * - No block introduces colour, shadows or rounded surfaces; the palette stays
 *   white/black and the line system carries the structure.
 */

export const Blocks = async ({ blocks, context }: { blocks: BlockRow[] | null | undefined; context: SiteContext }) => {
  const allowed = new Set(context.site.blocks)
  const rows = (blocks ?? []).filter((block) => block?.blockType)

  const rendered: ReactNode[] = []
  for (const [index, block] of rows.entries()) {
    const blockType = block.blockType ?? ''
    if (!allowed.has(blockType)) {
      warnUnknown(`${blockType} (not in the site's block allowlist)`)
      continue
    }
    rendered.push(
      <Block context={context} key={block.id ?? `${blockType}-${index}`} row={block} />,
    )
  }
  return <>{rendered}</>
}

const Block = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  switch (row.blockType) {
    case 'content':
      return <ContentBlock context={context} row={row} />
    case 'mediaBlock':
      return <MediaBlock context={context} row={row} />
    case 'cta':
      return <CtaBlock context={context} row={row} />
    case 'features':
      return <FeaturesBlock row={row} />
    case 'testimonials':
      return <TestimonialsBlock context={context} row={row} />
    case 'faq':
      return <FaqBlock context={context} row={row} />
    case 'contact':
      return <ContactBlock context={context} row={row} />
    case 'formBlock':
      return <FormBlock context={context} row={row} />
    case 'gallery':
      return <GalleryBlock context={context} row={row} />
    case 'team':
      return <TeamBlock context={context} row={row} />
    case 'pricing':
      return <PricingBlock context={context} row={row} />
    case 'logos':
      return <LogosBlock context={context} row={row} />
    case 'archive':
      return <ArchiveBlock context={context} row={row} />
    default:
      // Includes `productGrid`: this theme does not claim store support, so a grid of
      // products is skipped rather than half-rendered.
      warnUnknown(row.blockType ?? 'unknown')
      return null
  }
}

/* --- shared block furniture ---------------------------------------------- */

const intro = (row: BlockRow): { heading: null | string; intro: null | string } => ({
  heading: typeof row.heading === 'string' ? row.heading : null,
  intro: typeof row.intro === 'string' ? row.intro : null,
})

const BlockShell = ({
  children,
  heading,
  introText,
  mark,
  tone = 'default',
}: {
  children: ReactNode
  heading?: null | string
  introText?: null | string
  mark?: MarkVariant
  tone?: 'default' | 'tight'
}) => (
  <ContentContainer as="section" className={cn(tone === 'tight' ? 'section--tight py-10' : 'section')}>
    {heading || introText ? (
      <div className="relative mb-8">
        <DecorativeMark className="top-2 -start-1 hidden md:block" variant={mark ?? 'dash'} />
        {heading ? <Type className="ps-4 md:ps-6" role="heading">{heading}</Type> : null}
        {introText ? <p className="type-body mt-3 max-w-[60ch] ps-4 text-ink-secondary md:ps-6">{introText}</p> : null}
      </div>
    ) : null}
    {children}
  </ContentContainer>
)

const asMedia = (value: unknown): Media | null => (isMedia(value as never) ? (value as Media) : null)

/* --- blocks --------------------------------------------------------------- */

const ContentBlock = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const columns = Array.isArray(row.columns)
    ? (row.columns as { enableLink?: boolean; link?: CmsLink; richText?: unknown }[])
    : []
  if (columns.length === 0) return null
  return (
    <BlockShell>
      <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
        {columns.map((column, index) => (
          <div key={`column-${index}`}>
            <RichText content={column.richText as never} context={context} fallbackDir={context.dir} />
            {column.enableLink && column.link ? (
              <Link className="link-inline type-ui mt-4 target-standalone" href={linkHref(column.link)}>
                {linkLabel(column.link)}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </BlockShell>
  )
}

const MediaBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const media = asMedia(row.media)
  if (!media) {
    warnUnknown('mediaBlock with unpopulated media')
    return null
  }
  return (
    <BlockShell tone="tight">
      <div className="frame mx-auto max-w-[60rem]" style={{ aspectRatio: `${media.width ?? 3} / ${media.height ?? 2}` }}>
        <DecorativeMark className="top-1 end-1 hidden md:block" variant="corner" />
        <CmsImage className="frame__media" media={media} origin={context.site.media.origin} sizes="(min-width: 1024px) 60vw, 100vw" />
      </div>
      {media.alt ? <p className="type-caption mt-3 text-center">{media.alt}</p> : null}
    </BlockShell>
  )
}

const CtaBlock = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const links = Array.isArray(row.links) ? (row.links as Record<string, unknown>[]) : []
  return (
    <BlockShell tone="tight">
      <Rule className="mb-8" />
      <div className="flex flex-col items-start gap-6">
        <RichText content={row.richText as never} context={context} fallbackDir={context.dir} />
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {links.map((entry, index) => {
              const link = entry.link as Record<string, unknown> | undefined
              if (!link) return null
              const outline = link.appearance === 'outline'
              return (
                <Button asChild key={`cta-${index}`} variant={outline ? 'quiet' : 'default'}>
                  <Link href={linkHref(link)}>{linkLabel(link)}</Link>
                </Button>
              )
            })}
          </div>
        ) : null}
      </div>
    </BlockShell>
  )
}

const FeaturesBlock = ({ row }: { row: BlockRow }) => {
  const items = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (items.length === 0) return null
  const columns = typeof row.columns === 'string' ? row.columns : '3'
  return (
    <BlockShell heading={heading} introText={introText} mark="pair">
      <ul className={cn('grid gap-x-8 gap-y-10', columns === '2' ? 'md:grid-cols-2' : columns === '4' ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3')}>
        {items.map((item, index) => (
          <li className="relative border-t border-line-structural pt-5" key={`feature-${index}`}>
            <DecorativeMark className="top-5 -start-1 hidden md:block" variant="tick" />
            <h3 className="type-subheading ps-3">{String(item.title ?? '')}</h3>
            {item.description ? <p className="type-body mt-2 ps-3 text-ink-secondary">{String(item.description)}</p> : null}
          </li>
        ))}
      </ul>
    </BlockShell>
  )
}

const TestimonialsBlock = ({ row }: { context: SiteContext; row: BlockRow }) => {
  const items = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (items.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText}>
      <ul className="grid gap-10 md:grid-cols-2">
        {items.map((item, index) => (
          <li className="border-t border-line-structural pt-5" key={`quote-${index}`}>
            <blockquote className="type-body-lg">«{String(item.quote ?? '')}»</blockquote>
            {item.author ? (
              <p className="type-meta mt-3">
                {String(item.author)}
                {item.role ? ` — ${String(item.role)}` : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </BlockShell>
  )
}

const FaqBlock = ({ row }: { context: SiteContext; row: BlockRow }) => {
  const items = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (items.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText}>
      <Accordion className="border-t border-line-structural" collapsible type="single">
        {items.map((item, index) => (
          <AccordionItem key={`faq-${index}`} value={`faq-${index}`}>
            <AccordionTrigger>{String(item.question ?? '')}</AccordionTrigger>
            <AccordionContent>{String(item.answer ?? '')}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </BlockShell>
  )
}

const ContactBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const { heading, intro: introText } = intro(row)
  const phones = Array.isArray(row.phones) ? row.phones.filter((phone): phone is string => typeof phone === 'string') : []
  const entries: { label: string; value: ReactNode }[] = []
  const t = dictionary(context.locale)

  if (typeof row.address === 'string' && row.address.trim()) entries.push({ label: t.contact, value: row.address })
  if (typeof row.email === 'string' && row.email.trim()) {
    entries.push({
      label: 'Email',
      value: (
        <a className="link-inline target-standalone" dir="ltr" href={`mailto:${row.email}`}>
          {row.email}
        </a>
      ),
    })
  }
  if (phones.length > 0) {
    entries.push({
      label: context.locale === 'fa' ? 'تلفن' : 'Phone',
      value: (
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {phones.map((phone) => (
            <a className="link-inline target-standalone" dir="ltr" href={`tel:${phone.replace(/\s+/gu, '')}`} key={phone}>
              {toLocaleDigits(phone, context.locale)}
            </a>
          ))}
        </span>
      ),
    })
  }
  if (typeof row.hours === 'string' && row.hours.trim()) entries.push({ label: context.locale === 'fa' ? 'ساعات' : 'Hours', value: row.hours })
  // `mapUrl` is real CMS data; the theme links to it instead of embedding a third-party
  // frame (which would ship the visitor's IP to the map provider on load).
  if (typeof row.mapUrl === 'string' && /^https:\/\//u.test(row.mapUrl)) {
    entries.push({
      label: t.map,
      value: (
        <a className="link-inline target-standalone" href={row.mapUrl} rel="noreferrer" target="_blank">
          {t.map}
        </a>
      ),
    })
  }

  if (entries.length === 0) {
    // A `contact` block whose CMS fields are all empty is a content problem, not a
    // rendering one — say so rather than leaving a silently blank column.
    warnUnknown('contact block with no address, email, phones, hours or map link')
    return null
  }

  return (
    <BlockShell heading={heading} introText={introText} mark="offset-l">
      <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2">
        {entries.map((entry) => (
          <div className="border-t border-line-structural pt-4" key={entry.label}>
            <dt className="type-label">{entry.label}</dt>
            <dd className="type-body mt-1">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </BlockShell>
  )
}

const FormBlock = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const formRef = row.form
  const id = typeof formRef === 'string' ? formRef : ((formRef as { id?: string } | null)?.id ?? null)
  if (!id) return null
  const form: FormDoc | null = await getFormById(id, context.locale, context.draft)
  if (!form) {
    warnUnknown('formBlock pointing at a missing form')
    return null
  }
  return (
    <BlockShell tone="tight">
      {row.enableIntro && row.introContent ? (
        <RichText className="mb-8" content={row.introContent as never} context={context} fallbackDir={context.dir} />
      ) : null}
      <CmsForm className="max-w-[36rem]" form={form} locale={context.locale} />
    </BlockShell>
  )
}

const GalleryBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const images = (Array.isArray(row.images) ? row.images : []).map((entry) => (typeof entry === 'string' ? null : asMedia(entry))).filter((media): media is Media => Boolean(media))
  const { heading, intro: introText } = intro(row)
  const t = dictionary(context.locale)
  const items: GalleryItem[] = images.flatMap((media) => {
    const src = mediaUrl(media, context.site.media.origin)
    if (!src) return []
    return [
      {
        alt: media.alt ?? t.photo,
        height: media.height ?? undefined,
        id: String(media.id),
        src,
        srcSet: mediaSrcSet(media, context.site.media.origin),
        width: media.width ?? undefined,
      },
    ]
  })
  if (items.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText} mark="pair">
      <Gallery
        items={items}
        labels={{ close: t.close, next: t.next, previous: t.previous, title: t.gallery }}
        locale={context.locale}
      />
    </BlockShell>
  )
}

const TeamBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const members = Array.isArray(row.members) ? (row.members as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (members.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText}>
      <ul className="grid gap-x-8 gap-y-10 md:grid-cols-3">
        {members.map((member, index) => {
          const photo = asMedia(member.photo)
          return (
            <li key={`member-${index}`}>
              {photo ? (
                <span className="frame mb-4 block" style={{ aspectRatio: '3 / 4' }}>
                  <CmsImage className="frame__media" media={photo} origin={context.site.media.origin} sizes="(min-width: 768px) 30vw, 100vw" />
                </span>
              ) : null}
              <p className="type-subheading">{String(member.name ?? '')}</p>
              {member.role ? <p className="type-meta mt-1">{String(member.role)}</p> : null}
              {member.bio ? <p className="type-body mt-2 text-ink-secondary">{String(member.bio)}</p> : null}
            </li>
          )
        })}
      </ul>
    </BlockShell>
  )
}

const PricingBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const plans = Array.isArray(row.plans) ? (row.plans as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (plans.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText}>
      <ul className="grid gap-8 md:grid-cols-3">
        {plans.map((plan, index) => {
          const price = typeof plan.price === 'number' ? plan.price : null
          const unit = typeof plan.unit === 'string' ? plan.unit : ''
          const features = Array.isArray(plan.features) ? (plan.features as unknown[]).filter((f): f is string => typeof f === 'string') : []
          return (
            <li className={cn('border-t border-line-structural pt-5', plan.featured === true && 'border-t-[1px] border-t-ink')} key={`plan-${index}`}>
              <h3 className="type-subheading">{String(plan.name ?? '')}</h3>
              {price !== null ? (
                <p className="type-body-lg mt-3" dir="auto">
                  {formatNumber(price, context.locale)} {unit}
                </p>
              ) : null}
              {plan.period ? <p className="type-meta mt-1">{String(plan.period)}</p> : null}
              {features.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {features.map((feature) => (
                    <li className="type-body text-ink-secondary" key={feature}>
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </BlockShell>
  )
}

const LogosBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const logos = (Array.isArray(row.logos) ? row.logos : []).map((entry) => asMedia(entry)).filter((media): media is Media => Boolean(media))
  const { heading, intro: introText } = intro(row)
  if (logos.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText} tone="tight">
      <ul className="flex flex-wrap items-center gap-10">
        {logos.map((media) => {
          const src = mediaUrl(media, context.site.media.origin)
          if (!src) return null
          return (
            <li key={String(media.id)}>
              <img alt={media.alt ?? ''} className="h-10 w-auto opacity-80" loading="lazy" src={src} />
            </li>
          )
        })}
      </ul>
    </BlockShell>
  )
}

const ArchiveBlock = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const limit = typeof row.limit === 'number' ? Math.min(Math.max(row.limit, 1), 24) : 6
  const selected = Array.isArray(row.selectedDocs)
    ? (row.selectedDocs as { value?: string }[]).map((entry) => entry.value).filter((id): id is string => Boolean(id))
    : []

  let posts: PostDoc[] = []
  if (row.populateBy === 'selection' && selected.length > 0) {
    posts = await getPostsByIds(selected, context.locale, context.draft)
  } else {
    const categoryIds = Array.isArray(row.categories)
      ? (row.categories as unknown[]).map((entry) => (typeof entry === 'string' ? entry : (entry as { id?: string })?.id)).filter((id): id is string => Boolean(id))
      : []
    const result = await getPosts(
      context.locale,
      { limit, where: categoryIds.length ? { categories: { in: categoryIds } } : {} },
      context.draft,
    )
    posts = result.docs
  }

  const { heading, intro: introText } = intro(row)
  if (posts.length === 0) return null

  return (
    <BlockShell heading={heading} introText={introText}>
      <ul>
        {posts.map((post) => (
          <ArchiveRow context={context} key={post.id} post={post} />
        ))}
      </ul>
    </BlockShell>
  )
}

const ArchiveRow = async ({ context, post }: { context: SiteContext; post: PostDoc }) => {
  const href = await postHref(post, context)
  return (
    <li className="border-b border-line-structural">
      <Link className="card__link flex items-baseline justify-between gap-6 py-5" href={href}>
        <span className="type-body">{post.title}</span>
        {dateText(post.publishedAt, context.locale) ? (
          <span className="type-meta">{dateText(post.publishedAt, context.locale)}</span>
        ) : null}
      </Link>
    </li>
  )
}

/* --- link helpers (blocks store `link` groups like navigation) ------------ */

const linkLabel = (link: Record<string, unknown>): string =>
  (typeof link.label === 'string' && link.label.trim()) || (typeof link.url === 'string' ? link.url : '')

const linkHref = (link: Record<string, unknown>): string =>
  typeof link.url === 'string' && link.url.trim() ? link.url : '#'
