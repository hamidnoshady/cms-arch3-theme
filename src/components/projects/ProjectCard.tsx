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

/** The pairs a project's facts block shows — exactly the non-empty CMS fields, in contract order. */
export const projectFactPairs = (post: PostDoc, locale: SiteContext['locale']): { label: string; value: string }[] => {
  const facts = post.projectMetadata
  if (!facts) return []
  const fa = locale === 'fa'
  const pairs: { label: string; value: string }[] = []
  if (facts.location?.trim()) pairs.push({ label: fa ? 'مکان' : 'Location', value: facts.location.trim() })
  const date = dateOrText(facts.date, locale)
  if (date) pairs.push({ label: fa ? 'تاریخ' : 'Date', value: date })
  if (facts.area?.trim()) pairs.push({ label: fa ? 'مساحت' : 'Area', value: facts.area.trim() })
  if (facts.status?.trim()) pairs.push({ label: fa ? 'وضعیت' : 'Status', value: facts.status.trim() })
  if (facts.client?.trim()) pairs.push({ label: fa ? 'کارفرما' : 'Client', value: facts.client.trim() })
  for (const extra of facts.additionalFacts ?? []) {
    if (extra?.label?.trim() && extra.value?.trim()) pairs.push({ label: extra.label.trim(), value: extra.value.trim() })
  }
  return pairs
}

/**
 * The facts block on a project detail page — real fields only, and not a table.
 *
 * A compact drafting-style block (`.facts`): one thin top rule, a tiny tick before
 * each label, the value set closely beside its label, two columns where the width
 * allows and one on narrow phones, capped around 900px so a label is never a
 * screen-width away from its value on a wide display. No cards, no fills, no grid of
 * borders — spacing and type carry the hierarchy.
 */
export const ProjectFacts = ({ className, context, post }: { className?: string; context: SiteContext; post: PostDoc }) => {
  const pairs = projectFactPairs(post, context.locale)
  if (pairs.length === 0) return null
  const title = context.locale === 'fa' ? 'مشخصات پروژه' : 'Project facts'

  return (
    <section aria-label={title} className={cn('facts', className)}>
      <dl className="facts__list">
        {pairs.map((pair) => (
          <div className="facts__item" key={`${pair.label}-${pair.value}`}>
            <dt className="facts__label">{pair.label}</dt>
            <dd className="facts__value" dir="auto">
              {pair.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
