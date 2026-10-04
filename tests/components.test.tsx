// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Pagination } from '@/components/design/Pagination'
import { Rule } from '@/components/design/Rule'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The line system's accessibility contract: decorations are never interactive, never
 * announced and never part of the layout tree that shifts; structural rules carry no
 * content of their own.
 */
describe('DecorativeMark', () => {
  it('is hidden from assistive technology and cannot be focused or clicked', () => {
    const { container } = render(<DecorativeMark variant="crosshair" />)
    const mark = container.querySelector('[data-mark="crosshair"]')
    expect(mark).not.toBeNull()
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    expect(mark?.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor')
    expect(mark?.querySelector('svg')?.getAttribute('vector-effect')).toBe('non-scaling-stroke')
  })

  it('renders all six documented variants deterministically', () => {
    const variants = ['corner', 'crosshair', 'dash', 'offset-l', 'pair', 'tick'] as const
    for (const variant of variants) {
      const { container } = render(<DecorativeMark variant={variant} />)
      expect(container.querySelector(`[data-mark="${variant}"]`)).not.toBeNull()
    }
  })
})

describe('structural rules', () => {
  it('are presentational only', () => {
    const { container } = render(<Rule />)
    const rule = container.querySelector('.rule-h')
    expect(rule).not.toBeNull()
    expect(rule?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.rule-h--emphasis')).toBeNull()
    const { container: emphasised } = render(<Rule tone="emphasis" />)
    expect(emphasised.querySelector('.rule-h--emphasis')).not.toBeNull()
  })
})

describe('Skeleton', () => {
  it('hides placeholder geometry from screen readers', () => {
    const { container } = render(<Skeleton className="h-4 w-10" />)
    const skeleton = container.querySelector('.skeleton')
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('Pagination', () => {
  it('keeps the localized base path when paging an English archive', () => {
    const { container } = render(
      <Pagination
        basePath="/en/projects"
        currentPage={1}
        label="Pagination"
        labels={{ next: 'Next', previous: 'Previous' }}
        locale="en"
        totalPages={3}
      />,
    )
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    // Every control — first page, page numbers and next — stays under the English tree.
    expect(hrefs.every((href) => href?.startsWith('/en/projects'))).toBe(true)
    expect(hrefs).toContain('/en/projects?page=2')
    expect(hrefs).toContain('/en/projects?page=3')
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Pagination')
  })

  it('formats page numbers in the locale digits and preserves the filter query', () => {
    const { container } = render(
      <Pagination
        basePath="/projects"
        currentPage={1}
        label="صفحه‌بندی"
        labels={{ next: 'بعدی', previous: 'پیشین' }}
        locale="fa"
        query="?category=residential"
        totalPages={3}
      />,
    )
    const next = container.querySelector('a[href="/projects?category=residential&page=2"]')
    expect(next?.textContent).toBe('۲')
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('صفحه‌بندی')
  })
})
