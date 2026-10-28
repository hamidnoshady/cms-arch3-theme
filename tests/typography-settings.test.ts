import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  LOCALE_SIZE_SETTINGS,
  SIZE_DEFAULT,
  SIZE_SETTINGS,
  TYPOGRAPHY_SETTING_KEYS,
  typographyCss,
  WEIGHT_SETTINGS,
} from '@/lib/theme/typography'

type Setting = { default: number | string; max?: number; min?: number; options?: { value: string }[]; type: string }

const manifest = JSON.parse(readFileSync(new URL('../eshobe.theme.json', import.meta.url), 'utf8')) as {
  settings: Record<string, Setting>
}
const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

describe('typography settings', () => {
  it('declares every setting the code reads, with defaults that change nothing', () => {
    for (const key of TYPOGRAPHY_SETTING_KEYS) expect(manifest.settings[key], key).toBeDefined()
    for (const { key } of [...SIZE_SETTINGS, ...LOCALE_SIZE_SETTINGS]) {
      expect(manifest.settings[key]).toMatchObject({ type: 'number', default: SIZE_DEFAULT, min: 50, max: 200 })
    }
    for (const { defaultWeight, key } of WEIGHT_SETTINGS) {
      const setting = manifest.settings[key]!
      expect(setting.type).toBe('select')
      expect(setting.default).toBe(String(defaultWeight))
      expect(setting.options!.map((option) => option.value)).toEqual(['100', '200', '300', '400', '500', '600', '700', '800', '900'])
    }
  })

  it('drives variables the tokens actually read', () => {
    expect(tokens).toContain('var(--size-locale, 1)')
    for (const { cssVar } of SIZE_SETTINGS) expect(tokens, cssVar).toContain(`var(${cssVar}, 1)`)
    for (const { cssVar } of WEIGHT_SETTINGS) expect(tokens, cssVar).toMatch(new RegExp(`${cssVar}:`, 'u'))
  })

  it('emits nothing for an untouched site', () => {
    expect(typographyCss(null)).toBe('')
    expect(typographyCss({})).toBe('')
    const defaults = Object.fromEntries(
      TYPOGRAPHY_SETTING_KEYS.map((key) => [key, manifest.settings[key]!.default]),
    )
    expect(typographyCss(defaults)).toBe('')
  })

  it('turns edited values into multipliers, weights and per-locale scales', () => {
    const css = typographyCss({ sizeTitle: 120, sizeNav: '90', weightTitle: '700', sizeScaleFa: 110, sizeScaleEn: 100 })
    expect(css).toBe("html:root{--size-title:1.2;--size-nav:0.9;--weight-title:700}html[lang='fa']:root{--size-locale:1.1}")
  })

  it('rejects anything that is not a safe number', () => {
    const css = typographyCss({
      sizeBody: '1;}body{display:none',
      sizeTitle: 999,
      sizeCaption: 10,
      weightBody: '450',
      weightMeta: 'bold',
      weightStrong: 1000,
    })
    expect(css).toBe('html:root{--size-title:2;--size-caption:0.5}')
  })

  it('wires the horizontal home menu to the typography tokens', () => {
    const components = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8')
    const label = components.match(/\n {2}\.home-hmenu__label \{([^}]*)\}/)![1]!
    expect(label).toContain('var(--size-home-menu, 1)')
    expect(label).toContain('var(--size-locale, 1)')
    expect(label).toContain('var(--weight-home-menu)')
  })
})
