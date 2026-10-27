import Link from 'next/link'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { CmsImage } from '@/components/media/CmsImage'
import type { SiteContext } from '@/lib/cms/context'
import type { PostDoc } from '@/lib/cms/types'
import { cn } from '@/lib/utils/cn'
import { dateText } from '@/lib/utils/dates'
import { isMedia } from '@/lib/utils/media'
import { truncate } from '@/lib/utils/text'

/** Author names come from the privacy-safe `populatedAuthors` field only. */
export const authorLine = (post: PostDoc): null | string => {
  const names = (post.populatedAuthors ?? [])
    .map((author) => author?.name?.trim())
    .filter((name): name is string => Boolean(name))
  return names.length ? names.join('، ') : null
}

export const LeadStory = ({
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
  const author = authorLine(post)
  return (
    <article className="relative">
      <DecorativeMark className="top-1 -start-1 hidden md:block" variant="crosshair" />
      <p className="type-label ps-4 md:ps-6">{context.locale === 'fa' ? 'یادداشت شاخص' : 'Lead story'}</p>
      <h2 className="type-heading mt-3 max-w-[30ch] ps-4 md:ps-6">
        <Link className="link-inline target-standalone" href={href}>
          {post.title}
        </Link>
      </h2>
      {post.meta?.description ? (
        <p className="type-body mt-4 max-w-[58ch] ps-4 text-ink-secondary md:ps-6">
          {truncate(post.meta.description, 240)}
        </p>
      ) : null}
      <p className="type-meta mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 ps-4 md:ps-6">
        {author ? <span>{author}</span> : null}
        {dateText(post.publishedAt, context.locale) ? <span>{dateText(post.publishedAt, context.locale)}</span> : null}
        {category ? <span>{category}</span> : null}
        {minutes > 0 ? <span>{minutes > 0 ? `${minutes} ${context.locale === 'fa' ? 'دقیقه' : 'min'}` : ''}</span> : null}
      </p>
      {media ? (
        <span className="frame mt-8 block" style={{ aspectRatio: '3 / 2' }}>
          <CmsImage
            className="frame__media"
            media={media}
            origin={context.site.media.origin}
            sizes="(min-width: 1024px) 55vw, 100vw"
          />
        </span>
      ) : null}
    </article>
  )
}

/** A compact "latest notes" item for the column beside the lead story. */
export const LatestNote = ({
  context,
  href,
  post,
}: {
  context: SiteContext
  href: string
  post: PostDoc
}) => (
  <li className="relative border-b border-line-structural py-4">
    <DecorativeMark className="bottom-4 -start-1 hidden md:block" variant="dash" />
    <Link className="card__link" href={href}>
      <span className="card__title">{post.title}</span>
      <span className="card__meta mt-1 block">{dateText(post.publishedAt, context.locale) ?? ''}</span>
    </Link>
  </li>
)

export const ArticleRow = ({
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
    <li className="entry-row">
      <span className={cn('frame block', !media && 'frame--blank')} style={{ aspectRatio: '1 / 1' }}>
        {media ? (
          <CmsImage className="frame__media" media={media} origin={context.site.media.origin} sizes="160px" />
        ) : (
          <DecorativeMark className="frame__blank-mark" variant="crosshair" />
        )}
      </span>
      <div className="min-w-0">
        <h3 className="type-subheading">
          <Link className="link-inline target-standalone" href={href}>
            {post.title}
          </Link>
        </h3>
        {post.meta?.description ? (
          <p className="type-body mt-2 max-w-[60ch] text-ink-secondary">{truncate(post.meta.description, 180)}</p>
        ) : null}
        <p className="type-meta mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {category ? <span>{category}</span> : null}
          {dateText(post.publishedAt, context.locale) ? <span>{dateText(post.publishedAt, context.locale)}</span> : null}
          {minutes > 0 ? <span>{minutes} {context.locale === 'fa' ? 'دقیقه' : 'min'}</span> : null}
        </p>
      </div>
    </li>
  )
}
