/**
 * Typography theme settings → CSS custom properties.
 *
 * `src/styles/tokens.css` multiplies every text size by `--size-<role>` and
 * `--size-locale`, and reads every applied weight from `--weight-<role>`. This module
 * turns the operator's runtime settings (`themeRuntime.settings`, declared in
 * `eshobe.theme.json`) into the few declarations that change those variables, and
 * nothing for a setting left at its default — so an untouched site renders exactly
 * the designed scale.
 *
 * Every value is re-validated here and written as a bare number, so a setting can
 * never inject CSS even if the CMS stored something unexpected.
 */

export type SizeSetting = { cssVar: string; key: string }
export type WeightSetting = { cssVar: string; defaultWeight: number; key: string }

/** Percent of the designed size; 100 = unchanged. */
export const SIZE_DEFAULT = 100
export const SIZE_MIN = 50
export const SIZE_MAX = 200

export const SIZE_SETTINGS: readonly SizeSetting[] = [
  { key: 'sizeDisplay', cssVar: '--size-display' },
  { key: 'sizeTitle', cssVar: '--size-title' },
  { key: 'sizeHeading', cssVar: '--size-heading' },
  { key: 'sizeSubheading', cssVar: '--size-subheading' },
  { key: 'sizeLead', cssVar: '--size-body-lg' },
  { key: 'sizeBody', cssVar: '--size-body' },
  { key: 'sizeSummary', cssVar: '--size-summary' },
  { key: 'sizeUi', cssVar: '--size-ui' },
  { key: 'sizeNav', cssVar: '--size-nav' },
  { key: 'sizeButton', cssVar: '--size-button' },
  { key: 'sizeCardTitle', cssVar: '--size-card-title' },
  { key: 'sizeHomeMenu', cssVar: '--size-home-menu' },
  { key: 'sizeMobileMenu', cssVar: '--size-mobile-menu' },
  { key: 'sizeLabel', cssVar: '--size-label' },
  { key: 'sizeMeta', cssVar: '--size-meta' },
  { key: 'sizeCaption', cssVar: '--size-caption' },
]

/** Whole-scale multipliers per language, applied on top of every role. */
export const LOCALE_SIZE_SETTINGS = [
  { key: 'sizeScaleFa', locale: 'fa' },
  { key: 'sizeScaleEn', locale: 'en' },
] as const

/** Defaults mirror the applied weights in `tokens.css`. */
export const WEIGHT_SETTINGS: readonly WeightSetting[] = [
  { key: 'weightDisplay', cssVar: '--weight-display', defaultWeight: 500 },
  { key: 'weightTitle', cssVar: '--weight-title', defaultWeight: 500 },
  { key: 'weightHeading', cssVar: '--weight-heading', defaultWeight: 500 },
  { key: 'weightBody', cssVar: '--weight-body', defaultWeight: 400 },
  { key: 'weightSummary', cssVar: '--weight-summary', defaultWeight: 300 },
  { key: 'weightUi', cssVar: '--weight-ui', defaultWeight: 500 },
  { key: 'weightNav', cssVar: '--weight-nav', defaultWeight: 500 },
  { key: 'weightButton', cssVar: '--weight-button', defaultWeight: 500 },
  { key: 'weightCardTitle', cssVar: '--weight-card-title', defaultWeight: 500 },
  { key: 'weightHomeMenu', cssVar: '--weight-home-menu', defaultWeight: 300 },
  { key: 'weightMobileMenu', cssVar: '--weight-mobile-menu', defaultWeight: 500 },
  { key: 'weightLabel', cssVar: '--weight-label', defaultWeight: 500 },
  { key: 'weightMeta', cssVar: '--weight-meta', defaultWeight: 400 },
  { key: 'weightStrong', cssVar: '--weight-strong', defaultWeight: 600 },
]

export const TYPOGRAPHY_SETTING_KEYS: readonly string[] = [
  ...SIZE_SETTINGS.map((setting) => setting.key),
  ...LOCALE_SIZE_SETTINGS.map((setting) => setting.key),
  ...WEIGHT_SETTINGS.map((setting) => setting.key),
]

type Settings = Record<string, boolean | number | string> | null | undefined

const numeric = (value: unknown): null | number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

/** A percent setting as a multiplier, or null when unset or at 100%. */
const sizeFactor = (value: unknown): null | number => {
  const percent = numeric(value)
  if (percent === null) return null
  const clamped = Math.min(SIZE_MAX, Math.max(SIZE_MIN, percent))
  if (clamped === SIZE_DEFAULT) return null
  return Math.round(clamped * 100) / 10000
}

/** A weight setting, or null when unset, at its default, or not a 100–900 step. */
const weightValue = (value: unknown, fallback: number): null | number => {
  const weight = numeric(value)
  if (weight === null || weight < 100 || weight > 900 || weight % 100 !== 0) return null
  return weight === fallback ? null : weight
}

/**
 * The declarations for the operator's typography settings. `html:root` outranks the
 * plain `:root` in `tokens.css`, so the result wins wherever the `<style>` lands.
 * Returns an empty string when every setting is at its default.
 */
export const typographyCss = (settings: Settings): string => {
  const values = settings ?? {}
  const root: string[] = []

  for (const { cssVar, key } of SIZE_SETTINGS) {
    const factor = sizeFactor(values[key])
    if (factor !== null) root.push(`${cssVar}:${factor}`)
  }
  for (const { cssVar, defaultWeight, key } of WEIGHT_SETTINGS) {
    const weight = weightValue(values[key], defaultWeight)
    if (weight !== null) root.push(`${cssVar}:${weight}`)
  }

  const rules: string[] = []
  if (root.length) rules.push(`html:root{${root.join(';')}}`)
  for (const { key, locale } of LOCALE_SIZE_SETTINGS) {
    const factor = sizeFactor(values[key])
    if (factor !== null) rules.push(`html[lang='${locale}']:root{--size-locale:${factor}}`)
  }
  return rules.join('')
}
