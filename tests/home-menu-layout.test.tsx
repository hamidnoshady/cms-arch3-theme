// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HomeStage, type HomeStageProps } from '@/components/home/HomeStage'

/**
 * `homeMenuLayout`: vertical keeps the separate numbered section; horizontal puts one
 * row under the logo that the Enter control (or focus) opens in place.
 */

vi.mock('@/components/layout/LanguageSwitch', () => ({ LanguageSwitch: () => null }))

beforeEach(() => {
  window.sessionStorage.clear()
  window.scrollTo = vi.fn() as typeof window.scrollTo
  // jsdom has no IntersectionObserver; Motion's in-view rows need one to mount.
  globalThis.IntersectionObserver = class {
    disconnect() {}
    observe() {}
    takeRecords() {
      return []
    }
    unobserve() {}
  } as unknown as typeof IntersectionObserver
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {},
    }),
    writable: true,
  })
})

const props: HomeStageProps = {
  dir: 'rtl',
  enterLabel: 'ورود',
  introDuration: 1200,
  introEnabled: false,
  languageLabel: 'Language',
  links: [
    { current: false, external: false, href: '/projects', index: '۰۱', label: 'پروژه‌ها', newTab: false },
    { current: false, external: false, href: '/contact', index: '۰۲', label: 'تماس', newTab: false },
  ],
  locale: 'fa',
  logo: null,
  menuLabel: 'فهرست سایت',
  menuNoScript: '',
  name: 'Studio',
  scrollCue: 'اسکرول کنید',
  switchTargets: [],
}

describe('home menu layout', () => {
  it('defaults to the vertical section below the stage', () => {
    const { container } = render(<HomeStage {...props} />)
    expect(container.querySelector('nav.home-menu')).not.toBeNull()
    expect(container.querySelector('.home-hmenu')).toBeNull()
    expect(screen.getByRole('button', { name: 'ورود' }).hasAttribute('aria-expanded')).toBe(false)
  })

  it('horizontal: the row lives inside the logo stage and Enter opens it and focuses the first link', () => {
    const { container } = render(<HomeStage {...props} menuLayout="horizontal" />)
    const intro = container.querySelector('.home-intro--horizontal')!
    expect(intro.querySelector('nav.home-hmenu')).not.toBeNull()
    expect(container.querySelector('nav.home-menu')).toBeNull()
    expect(intro.getAttribute('data-open')).toBe('false')

    const enter = screen.getByRole('button', { name: 'ورود' })
    expect(enter.getAttribute('aria-expanded')).toBe('false')
    expect(enter.getAttribute('aria-controls')).toBe('home-menu')
    fireEvent.click(enter)

    expect(intro.getAttribute('data-open')).toBe('true')
    expect(document.activeElement?.textContent).toContain('پروژه‌ها')
    expect(window.sessionStorage.getItem('arch2:entered')).toBe('1')
  })

  it('horizontal: tabbing onto a link opens the row', () => {
    const { container } = render(<HomeStage {...props} menuLayout="horizontal" />)
    fireEvent.focus(screen.getByRole('link', { name: /تماس/u }))
    expect(container.querySelector('.home-intro--horizontal')!.getAttribute('data-open')).toBe('true')
  })
})
