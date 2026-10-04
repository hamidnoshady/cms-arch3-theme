'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useState, type KeyboardEvent } from 'react'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { Locale } from '@/lib/cms/types'
import { formatNumber } from '@/lib/runtime'
import { cn } from '@/lib/utils/cn'

/**
 * Gallery + lightbox.
 *
 * A gallery library was not needed: the interaction is a grid of buttons and one
 * themed shadcn Dialog (focus trap, Escape, focus restoration for free). The on-screen
 * controls and direction-aware Arrow keys move between images; the lightbox title and
 * the politely-announced counter name the current position in the active locale.
 */
export type GalleryItem = {
  alt: string
  height?: number
  id: string
  src: string
  srcSet?: string
  width?: number
}

export const Gallery = ({
  className,
  items,
  labels,
  locale,
}: {
  className?: string
  items: GalleryItem[]
  labels: { close: string; next: string; previous: string; title: string }
  locale: Locale
}) => {
  const [openIndex, setOpenIndex] = useState<null | number>(null)
  const [open, setOpen] = useState(false)

  const show = useCallback(
    (index: number) => {
      setOpenIndex(index)
      setOpen(true)
    },
    [],
  )

  if (items.length === 0) return null

  const step = (delta: number): void => {
    setOpenIndex((current) => {
      if (current === null) return current
      const next = (current + delta + items.length) % items.length
      return next
    })
  }

  const active = openIndex === null ? null : items[openIndex]
  const position =
    openIndex === null
      ? ''
      : `${formatNumber(openIndex + 1, locale)} / ${formatNumber(items.length, locale)}`

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    // Direction-aware: the arrow that advances along the reading direction is Right in
    // LTR and Left in RTL.
    const forward = locale === 'fa' ? event.key === 'ArrowLeft' : event.key === 'ArrowRight'
    step(forward ? 1 : -1)
  }

  return (
    <div className={className}>
      <ul className="grid-media">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              className="gallery-item gallery-item--button frame"
              onClick={() => show(index)}
              style={{ aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : '4 / 3' }}
              type="button"
            >
              <DecorativeMark className="top-1 end-1 hidden md:block" variant="corner" />
              <img
                alt={item.alt}
                className="frame__media"
                decoding="async"
                loading="lazy"
                height={item.height}
                sizes="(min-width: 768px) 33vw, 50vw"
                src={item.src}
                srcSet={item.srcSet}
                style={{ aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : '4 / 3' }}
                width={item.width}
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent
          // Full-viewport lightbox: `inset-0`, the explicit translate reset and the
          // transparent intent overrides the themed centred panel (tailwind-merge
          // resolves each conflicting utility), and no `title` means no header row.
          className="inset-0 flex max-h-none w-auto translate-x-0 translate-y-0 flex-col items-center justify-center overflow-visible p-4 md:p-10"
          dir={locale === 'fa' ? 'rtl' : 'ltr'}
          onKeyDown={onKeyDown}
        >
          <DialogTitle className="sr-only">
            {active ? `${labels.title} — ${position}` : labels.title}
          </DialogTitle>
          {active ? (
            <img
              alt={active.alt}
              className="max-h-[80svh] w-auto bg-surface object-contain"
              src={active.src}
              srcSet={active.srcSet}
            />
          ) : null}
          <div className={cn('mt-4 flex items-center gap-2 bg-surface p-1')}>
            <button aria-label={labels.previous} className="btn btn--square" onClick={() => step(-1)} type="button">
              <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
            </button>
            <span aria-live="polite" className="type-meta px-2">
              {position}
            </span>
            <button aria-label={labels.next} className="btn btn--square" onClick={() => step(1)} type="button">
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
            </button>
            <DialogClose aria-label={labels.close} className="btn btn--square" type="button">
              <X aria-hidden="true" size={18} strokeWidth={1.5} />
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
