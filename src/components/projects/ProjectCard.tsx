import Link from 'next/link'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { CmsImage } from '@/components/media/CmsImage'
import type { SiteContext } from '@/lib/cms/context'
import type { PostDoc } from '@/lib/cms/types'
import { cn } from '@/lib/utils/cn'
import { dateOrText } from '@/lib/utils/dates'
import { frameRatioFor, isMedia } from '@/lib/utils/media'

/**
 * Project card.
 *
 * - The image fills its area edge-to-edge; the structural rectangle is inset **5px
 *   inside the photograph** (`.frame`), with a small drafting dash for identity.
 * - The frame keeps the media's own orientation (3:2 landscape, 3:4 portrait, 1:1
 *   square) so a portrait project is never squashed into a landscape crop.
 * - Two cards per row on mobile by design (`grid-projects`).
 * - Caption shows only real data: the project's location/year when the CMS has them,
 *   otherwise nothing — no invented metadata.
 */
export const ProjectCard = ({
  context,
  href,
  post,
}: {
  context: SiteContext
  href: string
  post: PostDoc
}) => {
  const media = isMedia(post.heroImage) ? post.heroImage : null
  const meta = factLine(post, context)

  return (
    <article className="card group">
      <Link className="card__link relative" href={href}>
        <span className="frame block" style={{ aspectRatio: frameRatioFor(media) }}>
          <CmsImage
            className="frame__media transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            media={media}
            origin={context.site.media.origin}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 45vw"
          />
          <DecorativeMark className="bottom-2 end-2 hidden md:block" variant="dash" />
        </span>
        <span className="card__caption mt-3">
          <span className="card__title">{post.title}</span>
          {meta ? <span className="card__meta">{meta}</span> : null}
        </span>
        <span aria-hidden="true" className="caption-rule mt-2" />
      </Link>
    </article>
  )
}

/** Location · year, but only for values the CMS actually returned. */
const factLine = (post: PostDoc, context: SiteContext): null | string => {
  const facts = post.projectMetadata
  if (!facts) return null
  const parts = [
    facts.location?.trim() || null,
    dateOrText(facts.date, context.locale, { year: 'numeric' }),
  ].filter((value): value is string => Boolean(value))
  return parts.length ? parts.join(' · ') : null
}

export const projectMetaLine = factLine

/** The facts table on a project detail page — again, real fields only. */
export const ProjectFacts = ({ context, post }: { context: SiteContext; post: PostDoc }) => {
  const facts = post.projectMetadata
  if (!facts) return null
  const t = context.locale === 'fa' ? 'مشخصات پروژه' : 'Project facts'
  const pairs: { label: string; value: string }[] = []
  if (facts.location?.trim()) pairs.push({ label: context.locale === 'fa' ? 'مکان' : 'Location', value: facts.location.trim() })
  const date = dateOrText(facts.date, context.locale)
  if (date) pairs.push({ label: context.locale === 'fa' ? 'تاریخ' : 'Date', value: date })
  if (facts.area?.trim()) pairs.push({ label: context.locale === 'fa' ? 'مساحت' : 'Area', value: facts.area.trim() })
  if (facts.status?.trim()) pairs.push({ label: context.locale === 'fa' ? 'وضعیت' : 'Status', value: facts.status.trim() })
  if (facts.client?.trim()) pairs.push({ label: context.locale === 'fa' ? 'کارفرما' : 'Client', value: facts.client.trim() })
  for (const extra of facts.additionalFacts ?? []) {
    if (extra?.label?.trim() && extra.value?.trim()) pairs.push({ label: extra.label.trim(), value: extra.value.trim() })
  }
  if (pairs.length === 0) return null

  return (
    <section aria-label={t} className={cn('mt-10')}>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line-structural pt-5 md:grid-cols-3">
        {pairs.map((pair) => (
          <div key={`${pair.label}-${pair.value}`}>
            <dt className="type-label">{pair.label}</dt>
            <dd className="type-body mt-1" dir="auto">
              {pair.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
