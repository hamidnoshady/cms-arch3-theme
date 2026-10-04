// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Gallery } from '@/components/media/Gallery'

/**
 * The gallery's lightbox contract after the move onto the themed shadcn Dialog:
 * a thumbnail opens a real dialog with a localized title, the close control removes
 * it again, and Arrow keys move between images in the locale's reading direction
 * (Right advances in LTR, Left advances in RTL). Focus trapping and Escape are
 * Radix's; this pins the composition and the keyboard contract.
 */

const items = [
  { alt: 'نمای نخست', height: 1000, id: 'a', src: '/qa/media/one.png', width: 1500 },
  { alt: 'نمای دوم', height: 1000, id: 'b', src: '/qa/media/two.png', width: 1500 },
]

const labels = { close: 'بستن', next: 'بعدی', previous: 'قبلی', title: 'تصاویر' }

describe('gallery lightbox', () => {
  it('opens from a thumbnail and closes from the dialog control', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)

    // Two thumbnails plus the dialog controls live in the same tree; the thumbnails
    // are the buttons with an image inside before the dialog opens.
    const thumbs = [...document.querySelectorAll('.gallery-item--button')]
    expect(thumbs).toHaveLength(2)
    fireEvent.click(thumbs[0] as Element)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('dir')).toBe('rtl')
    expect(screen.getByRole('heading', { name: 'تصاویر — ۱ / ۲' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'بستن' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('moves with Arrow keys in the reading direction and ignores other keys', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)
    fireEvent.click(document.querySelectorAll('.gallery-item--button')[0] as Element)
    const dialog = await screen.findByRole('dialog')

    // RTL: Left advances to the second image, Right returns to the first.
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { name: 'تصاویر — ۲ / ۲' })).toBeTruthy()
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: 'تصاویر — ۱ / ۲' })).toBeTruthy()

    // Tab/Home are not gallery shortcuts: the position must not change.
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(screen.getByRole('heading', { name: 'تصاویر — ۱ / ۲' })).toBeTruthy()
  })

  it('uses the opposite arrow mapping in an LTR lightbox', async () => {
    render(<Gallery items={items} labels={{ ...labels, title: 'Gallery' }} locale="en" />)
    fireEvent.click(document.querySelectorAll('.gallery-item--button')[0] as Element)
    const dialog = await screen.findByRole('dialog')

    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: 'Gallery — 2 / 2' })).toBeTruthy()
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { name: 'Gallery — 1 / 2' })).toBeTruthy()
  })

  it('renders nothing when there are no media items', () => {
    const { container } = render(<Gallery items={[]} labels={labels} locale="en" />)
    expect(container.firstChild).toBeNull()
  })
})
