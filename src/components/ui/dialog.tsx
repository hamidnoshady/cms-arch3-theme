'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * shadcn/ui Dialog, themed: white panel, hairline edge, square, no shadow.
 *
 * Compositional on purpose — the parts are exported and the consumer supplies the
 * layout. The gallery lightbox is full-viewport, so it passes its own classes and a
 * visually hidden title; a titled dialog gets the theme's header row for free. Portals
 * render on `document.body`, so the consumer passes `dir` explicitly (the gallery does).
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

export const DialogOverlay = ({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) => (
  <DialogPrimitive.Overlay className={cn('drawer__overlay', className)} {...props} />
)

export const DialogContent = ({
  children,
  className,
  title,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { title?: string }) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      className={cn(
        'fixed left-1/2 top-1/2 z-[60] max-h-[90svh] w-[min(90vw,42rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto p-6',
        title ? 'surface-panel' : undefined,
        className,
      )}
      {...props}
    >
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="type-subheading">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close aria-label="close" className="btn btn--bare btn--square">
            <X aria-hidden="true" size={18} strokeWidth={1.5} />
          </DialogPrimitive.Close>
        </div>
      ) : null}
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
)
