import Link from 'next/link'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { CmsImage } from '@/components/media/CmsImage'
import type { SiteContext } from '@/lib/cms/context'
import type { PostDoc } from '@/lib/cms/types'
import { dateText } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'
import { isMedia } from '@/lib/utils/media'
import { readingTimeLabel, truncate } from '@/lib/utils/text'

/**
 * Education entries are a *different composition* from project cards: one restrained
 * featured entry, then compact horizontal rows (thumbnail at the inline start, text
 * beside it) separated by hairlines.
 *
 * Metadata is real: category title, publication date, and an honest reading time
 * derived from the entry's own content. There is no duration field in the contract, so
 * no duration is shown (a "12 min video" badge would be an invention).
 */
export const EducationFeatured = ({
  category,
  context,
  href,
  minutes,
  post,
}: {
  category?: null | string
  context: SiteContext
  href: string
  minutes: number
  post: PostDoc
}) => {
  const media = isMedia(post.heroImage) ? post.heroImage : null
  return (
    <article className="relative border-b border-line-structural pb-10">
      <DecorativeMark className="top-0 -start-1 hidden md:block" variant="pair" />
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:items-start">
        <div>
          <p className="type-label">{context.locale === 'fa' ? 'شاخص' : 'Featured'}</p>
          <h2 className="type-heading mt-3 max-w-[26ch]">
            <Link className="link-inline target-standalone" href={href}>
              {post.title}
            </Link>
          </h2>
          {post.meta?.description ? (
            <p className="type-body mt-4 max-w-[52ch] text-ink-secondary">{truncate(post.meta.description, 220)}</p>
          ) : null}
          <p className="type-meta mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {category ? <span>{category}</span> : null}
            {dateText(post.publishedAt, context.locale) ? <span>{dateText(post.publishedAt, context.locale)}</span> : null}
            {minutes > 0 ? <span>{readingTimeLabel(minutes, context.locale)}</span> : null}
          </p>
        </div>
        <span className="frame block" style={{ aspectRatio: media ? undefined : '4 / 3' }}>
          <CmsImage
            className="frame__media"
            media={media}
            origin={context.site.media.origin}
            sizes="(min-width: 768px) 40vw, 100vw"
          />
        </span>
      </div>
    </article>
  )
}

export const EducationRow = ({
  category,
  context,
  href,
  minutes,
  post,
}: {
  category?: null | string
  context: SiteContext
  href: string
  minutes: number
  post: PostDoc
}) => {
  const media = isMedia(post.heroImage) ? post.heroImage : null
  return (
    <li className="entry-row entry-row--compact">
      <span className="frame block" style={{ aspectRatio: '4 / 3' }}>
        <CmsImage
          className="frame__media"
          media={media}
          origin={context.site.media.origin}
          sizes="120px"
        />
        <DecorativeMark className="bottom-1 end-1" variant="tick" />
      </span>
      <div className="min-w-0">
        <h3 className="type-ui">
          <Link className="link-inline target-standalone" href={href}>
            {post.title}
          </Link>
        </h3>
        <p className={cn('type-meta mt-2 flex flex-wrap items-center gap-x-4 gap-y-1')}>
          {category ? <span>{category}</span> : null}
          {dateText(post.publishedAt, context.locale) ? <span>{dateText(post.publishedAt, context.locale)}</span> : null}
          {minutes > 0 ? <span>{readingTimeLabel(minutes, context.locale)}</span> : null}
        </p>
      </div>
    </li>
  )
}

