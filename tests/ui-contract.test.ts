import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The stylesheet side of the UI contract: numbers and selectors the design brief
 * fixes and a refactor could silently drift. Read as text on purpose — jsdom does
 * not lay out, and these are promises about the *source*, not about a browser.
 */

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const structure = read('src/styles/structure.css')
const components = read('src/styles/components.css')
const tokens = read('src/styles/tokens.css')

/** The CSS block(s) matching `selector` (the text between its `{` and the matching `}`). */
const blocks = (css: string, selector: string): string[] => {
  const out: string[] = []
  const pattern = new RegExp(`(^|[\\s,])${selector.replace(/[.[\]]/gu, '\\$&')}\\s*\\{`, 'gu')
  for (const match of css.matchAll(pattern)) {
    const start = match.index + match[0].length
    out.push(css.slice(start, css.indexOf('}', start)))
  }
  return out
}

/** The media-query bodies in `css` keyed by their condition. */
const mediaQueries = (css: string): Map<string, string[]> => {
  const map = new Map<string, string[]>()
  const pattern = /@media\s*([^{]+)\{/gu
  for (const match of css.matchAll(pattern)) {
    let depth = 1
    let cursor = match.index + match[0].length
    while (depth > 0 && cursor < css.length) {
      const char = css[cursor]
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      cursor += 1
    }
    const key = match[1]!.trim()
    map.set(key, [...(map.get(key) ?? []), css.slice(match.index + match[0].length, cursor - 1)])
  }
  return map
}

const px = (css: string, variable: string): number => {
  const match = css.match(new RegExp(`${variable}:\\s*(\\d+(?:\\.\\d+)?)px`, 'u'))
  if (!match) throw new Error(`${variable} is not a px value in:\n${css}`)
  return Number(match[1])
}

describe('media grid: 2 columns on phones and tablets, 3 on desktop', () => {
  it('defaults to two columns and only grows at the 64rem (desktop) breakpoint', () => {
    const [base] = blocks(structure, '.grid-media')
    expect(base).toMatch(/grid-template-columns:\s*repeat\(2,/u)

    const queries = mediaQueries(structure)
    const desktop = (queries.get('(min-width: 64rem)') ?? []).join('\n')
    expect(desktop).toMatch(/\.grid-media\s*\{[^}]*repeat\(3,/u)
    expect(desktop).toMatch(/\.grid-media--2\s*\{[^}]*repeat\(2,/u)
    expect(desktop).toMatch(/\.grid-media--4\s*\{[^}]*repeat\(4,/u)

    // Nothing about the media grid changes at tablet width any more.
    const tablet = (queries.get('(min-width: 48rem)') ?? []).join('\n')
    expect(tablet).not.toContain('.grid-media')
  })

  it('has no second, static grid implementation left behind', () => {
    expect(components).not.toContain('.media-grid__list')
    expect(components).not.toContain('.gallery-item--button')
  })
})

describe('homepage menu labels', () => {
  it('carry no permanent underline and signal the current page by weight instead', () => {
    const [label] = blocks(components, '.home-row__label')
    expect(label).toContain('text-decoration: none')
    expect(label).not.toMatch(/underline/u)
    expect(components).not.toMatch(/text-decoration-line:\s*underline/u)
    const current = blocks(components, ".home-row__link[aria-current='page'] .home-row__label")
    expect(current[0]).toMatch(/font-weight/u)
  })
})

describe('overlays', () => {
  it('give the lightbox its own full-page backdrop in the brief’s opacity range', () => {
    const [overlay] = blocks(components, '.lightbox__overlay')
    expect(overlay).toContain('position: fixed')
    expect(overlay).toContain('inset: 0')
    const alpha = Number(overlay!.match(/rgba\(0,\s*0,\s*0,\s*(0?\.\d+)\)/u)?.[1])
    expect(alpha).toBeGreaterThanOrEqual(0.45)
    expect(alpha).toBeLessThanOrEqual(0.55)
    // The lightbox layer stacks above its overlay.
    const [layer] = blocks(components, '.lightbox')
    expect(Number(layer!.match(/z-index:\s*(\d+)/u)?.[1])).toBeGreaterThan(Number(overlay!.match(/z-index:\s*(\d+)/u)?.[1]))
  })

  it('leave the navigation drawer’s wash untouched', () => {
    const [drawer] = blocks(components, '.drawer__overlay')
    expect(drawer).toContain('rgba(0, 0, 0, 0.25)')
  })
})

describe('navbar and logo sizing', () => {
  it('sets the chrome from tokens inside the brief’s ranges per breakpoint', () => {
    const queries = mediaQueries(tokens)
    const base = tokens.slice(0, tokens.indexOf('@media'))
    const tablet = (queries.get('(min-width: 48rem)') ?? []).join('\n')
    const desktop = (queries.get('(min-width: 64rem)') ?? []).join('\n')

    expect(px(base, '--navbar-block')).toBeGreaterThanOrEqual(80)
    expect(px(base, '--navbar-block')).toBeLessThanOrEqual(84)
    expect(px(base, '--logo-block')).toBeGreaterThanOrEqual(40)
    expect(px(base, '--logo-block')).toBeLessThanOrEqual(44)

    expect(px(tablet, '--navbar-block')).toBeGreaterThanOrEqual(86)
    expect(px(tablet, '--navbar-block')).toBeLessThanOrEqual(90)
    expect(px(tablet, '--logo-block')).toBeGreaterThanOrEqual(44)
    expect(px(tablet, '--logo-block')).toBeLessThanOrEqual(48)

    expect(px(desktop, '--navbar-block')).toBeGreaterThanOrEqual(90)
    expect(px(desktop, '--navbar-block')).toBeLessThanOrEqual(96)
    expect(px(desktop, '--logo-block')).toBeGreaterThanOrEqual(48)
    expect(px(desktop, '--logo-block')).toBeLessThanOrEqual(54)
  })

  it('drives the navbar and the logo from those tokens, with no fixed pixel height left', () => {
    const [navbar] = blocks(components, '.navbar__inner')
    expect(navbar).toContain('min-block-size: var(--navbar-block)')
    expect(components).not.toMatch(/min-block-size:\s*68px/u)

    const [logo] = blocks(components, '.navbar__logo')
    expect(logo).toContain('block-size: var(--logo-block)')
    expect(logo).toMatch(/inline-size:\s*auto/u)
    expect(logo).toMatch(/object-fit:\s*contain/u)
    expect(read('src/components/layout/Logo.tsx')).not.toMatch(/\bh-8\b|height=\{?["']?32/u)
  })
})

describe('prose media grids', () => {
  const typography = read('src/styles/typography.css')

  it('a grid inside prose is layout, not a list: no markers, no list indent, no staggered cells', () => {
    const [reset] = blocks(typography, '.prose .grid-media')
    expect(reset).toMatch(/list-style:\s*none/u)
    expect(reset).toMatch(/padding:\s*0/u)
    const spacing = typography.match(/\.prose \.grid-media > li \+ li\s*\{([^}]*)\}/u)?.[1]
    expect(spacing).toMatch(/margin-block-start:\s*0/u)
  })

  it('only text is held to the reading measure; figures use the column width', () => {
    expect(typography).toMatch(/\.prose > :where\([^)]*\bp\b[^)]*\)\s*\{[^}]*max-inline-size:\s*var\(--measure-prose\)/u)
    const [prose] = blocks(typography, '.prose')
    expect(prose ?? '').not.toContain('max-inline-size')
  })

  it('the named-grid label has a title, a rule and a count', () => {
    for (const part of ['.media-grid__head', '.media-grid__title', '.media-grid__rule', '.media-grid__count']) {
      expect(components).toContain(`${part} {`)
    }
  })
})
