'use client'

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import Link from 'next/link'
import { type CSSProperties, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { LanguageSwitch } from '@/components/layout/LanguageSwitch'
import { scrollToElement } from '@/components/motion/SmoothScroll'
import type { SwitchTarget } from '@/lib/seo/translations'

/**
 * The home entrance — the one page that is not an interior page.
 *
 * Two plain sections in normal document flow:
 *   1. a full-viewport stage holding the customer's logo, revealed once on load;
 *   2. the CMS header menu, directly below it.
 *
 * Scrolling (wheel, trackpad, touch, keyboard, the visible Enter control) moves from
 * one to the other. Nothing is intercepted: the logo's shrink-and-rise and the menu's
 * line drawing are *driven by* the scroll position, never in place of it, so the back
 * button, Space/PageDown, find-in-page and assistive scrolling all keep working.
 *
 * - **The intro does not replay.** Reaching the menu writes a `sessionStorage` flag;
 *   returning to `/` in the same tab lands on the menu with the logo already settled.
 * - **The uploaded logo is never inlined.** An SVG from the CMS is always an `<img>`,
 *   sized explicitly from the media record — a `viewBox`-only SVG has no intrinsic
 *   width and collapsed to 0px inside the old flex wrapper, which is why the logo
 *   never appeared. The "drawing" is a clip-path wipe of the image plus the theme's own
 *   drafting frame, which is also the fallback when no logo exists.
 * - `themeRuntime.settings.introAnimation === false` and reduced motion both render
 *   the settled state with no reveal.
 * - The language switch in the bar is the shared `LanguageSwitch`, so the entrance
 *   follows the same rule as the interior chrome: only the *other* language is
 *   offered, never the one being read.
 *
 * `themeRuntime.settings.homeMenuLayout` picks where the menu lives:
 * - `vertical` (default): the compact numbered list in its own section below the stage.
 * - `horizontal`: one row of links directly under the logo, inside the same first
 *   screen. The stage is a little taller than the viewport and its content is sticky,
 *   so a small scroll (or the Enter control, or tabbing into the menu) opens the row
 *   while the logo stays where it is.
 */

export type HomeLink = {
  current: boolean
  external: boolean
  href: string
  index: string
  label: string
  newTab: boolean
}

export type HomeLogo = { height: null | number; url: string; width: null | number }

export type HomeMenuLayout = 'horizontal' | 'vertical'

export type HomeStageProps = {
  dir: 'ltr' | 'rtl'
  enterLabel: string
  introDuration: number
  introEnabled: boolean
  /** Accessible name of the language switch (`labels.languageSwitch`). */
  languageLabel: string
  locale: 'en' | 'fa'
  logo: HomeLogo | null
  menuLabel: string
  menuLayout?: HomeMenuLayout
  menuNoScript: string
  name: string
  scrollCue: string
  switchTargets: SwitchTarget[]
  links: HomeLink[]
}

const SESSION_KEY = 'arch2:entered'
/** Scroll distance (px) that opens the horizontal menu: a nudge, not a page. */
const OPEN_AFTER = 8
const EASE = [0.22, 0.61, 0.36, 1] as const

const INTERACTIVE_TARGETS =
  'a, button, input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [tabindex]'
const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(INTERACTIVE_TARGETS) !== null

const subscribeStorage = (): (() => void) => () => {}
const readEntered = (): boolean => {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}
const writeEntered = (): void => {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* storage unavailable — behaviour stays correct, just not remembered */
  }
}

/**
 * The four drafting corners around the logo. Each is a fixed 18px SVG (never stretched,
 * so `pathLength` dashes stay exact) whose two arms draw once with the reveal.
 */
const FrameCorners = ({ animate, delay, duration }: { animate: boolean; delay: number; duration: number }) => (
  <span aria-hidden="true" className="home-logo__frame">
    {(['tl', 'tr', 'br', 'bl'] as const).map((corner, index) => (
      <svg className={`home-logo__corner home-logo__corner--${corner}`} fill="none" key={corner} viewBox="0 0 18 18">
        <motion.path
          animate={{ pathLength: 1 }}
          d="M0.5 18V0.5H18"
          initial={animate ? { pathLength: 0 } : false}
          transition={{ delay: delay + index * 0.08, duration, ease: EASE }}
        />
      </svg>
    ))}
  </span>
)

export const HomeStage = ({
  dir,
  enterLabel,
  introDuration,
  introEnabled,
  languageLabel,
  locale,
  logo,
  menuLabel,
  menuLayout = 'vertical',
  menuNoScript,
  name,
  scrollCue,
  switchTargets,
  links,
}: HomeStageProps) => {
  const reduced = useReducedMotion() ?? false
  const remembered = useSyncExternalStore(subscribeStorage, readEntered, () => false)
  const introRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLElement>(null)
  const horizontal = menuLayout === 'horizontal'
  const [opened, setOpened] = useState(false)
  // Horizontal only: the row under the logo. A visitor who already entered sees it open.
  const open = opened || remembered

  const reveal = introEnabled && !reduced && !remembered
  const seconds = Math.max(0.6, Math.min(introDuration, 4000) / 1000)

  // Scroll-linked, not scroll-replacing: the logo settles as the stage leaves the viewport.
  const { scrollY, scrollYProgress } = useScroll({ offset: ['start start', 'end start'], target: introRef })
  const logoScale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 0.55])
  const logoY = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '38%'])
  const logoOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0])
  const barLogoOpacity = useTransform(scrollYProgress, [0.7, 1], [0, 1])
  const cueOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])

  const openRow = useCallback((focus: boolean) => {
    setOpened(true)
    writeEntered()
    // The links are always in the DOM (only faded), so focus can move right away.
    if (focus) menuRef.current?.querySelector<HTMLElement>('a[href]')?.focus({ preventScroll: true })
  }, [])

  useMotionValueEvent(scrollY, 'change', (y) => {
    if (horizontal && !open && y > OPEN_AFTER) openRow(false)
  })

  const goToMenu = useCallback((focus: boolean) => {
    if (horizontal) {
      openRow(focus)
      return
    }
    const menu = menuRef.current
    if (!menu) return
    scrollToElement(menu)
    writeEntered()
    // `preventScroll` keeps the focus move from cancelling the smooth scroll.
    if (focus) menu.querySelector<HTMLElement>('a[href]')?.focus({ preventScroll: true })
  }, [horizontal, openRow])

  // Coming back in the same tab: land on the menu, not on a replayed entrance.
  // (The horizontal row is already on the first screen; `open` covers it.)
  useEffect(() => {
    if (horizontal || !remembered || !menuRef.current) return
    window.scrollTo({ behavior: 'instant', top: menuRef.current.offsetTop })
  }, [horizontal, remembered])

  // Reaching the menu by any route (wheel, touch, keys, anchor) counts as "entered".
  // The horizontal row is always in view, so there `openRow` records it instead.
  useEffect(() => {
    const menu = menuRef.current
    if (horizontal || !menu || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          writeEntered()
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(menu)
    return () => observer.disconnect()
  }, [horizontal])

  // Enter on the stage background goes to the menu. Links and buttons keep their keys,
  // and Space/arrows/PageDown are left to the browser — they already scroll.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'Enter' || isInteractiveTarget(event.target)) return
      const intro = introRef.current
      if (!intro || intro.getBoundingClientRect().bottom < window.innerHeight * 0.5) return
      event.preventDefault()
      goToMenu(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goToMenu])

  const logoBox = logo?.width && logo.height ? { aspectRatio: `${logo.width} / ${logo.height}` } : undefined

  return (
    <main className="stage home" dir={dir} id="content">
      <div className="home-bar shell-navbar">
        <motion.a
          aria-hidden="true"
          className="home-bar__mark"
          href="#content"
          onClick={(event) => {
            event.preventDefault()
            if (introRef.current) scrollToElement(introRef.current)
          }}
          style={{ opacity: barLogoOpacity }}
          tabIndex={-1}
        >
          {logo ? <img alt="" decoding="async" src={logo.url} style={logoBox} /> : <span className="navbar__wordmark">{name}</span>}
        </motion.a>
        <LanguageSwitch current={locale} hrefs={switchTargets} label={languageLabel} />
      </div>

      <section
        aria-label={name}
        className={horizontal ? 'home-intro home-intro--horizontal' : 'home-intro'}
        data-open={horizontal ? open : undefined}
        ref={introRef}
      >
        <div className="home-intro__hold">
          <motion.div
            className="home-logo"
            style={horizontal ? undefined : { opacity: logoOpacity, scale: logoScale, y: logoY }}
          >
            <div className="home-logo__inner">
              <FrameCorners animate={reveal} delay={0.1} duration={Math.min(seconds, 1.2)} />
              <motion.h1
                animate={{ clipPath: 'inset(0% 0% 0% 0%)', filter: 'blur(0px)', opacity: 1 }}
                className="home-logo__mark stage-intro-fx"
                initial={reveal ? { clipPath: 'inset(0% 50% 0% 50%)', filter: 'blur(6px)', opacity: 0 } : false}
                transition={{ delay: 0.25, duration: seconds, ease: EASE }}
              >
                {logo ? (
                  <img
                    alt={name}
                    className="home-logo__img"
                    data-logo="mark"
                    decoding="async"
                    fetchPriority="high"
                    height={logo.height ?? undefined}
                    src={logo.url}
                    style={logoBox}
                    width={logo.width ?? undefined}
                  />
                ) : (
                  // Same QA hook as `Logo`: "the customer has no logo" is a state worth
                  // proving (the site-name wordmark appears), not judged from a picture.
                  <span className="home-logo__wordmark" data-logo="wordmark">
                    {name}
                  </span>
                )}
              </motion.h1>
            </div>
            {/* Dimension line under the mark: ticks at both ends, the line scales out from the centre. */}
            <span aria-hidden="true" className="home-logo__datum">
              <motion.span
                animate={{ scaleX: 1 }}
                className="home-logo__datum-line"
                initial={reveal ? { scaleX: 0 } : false}
                transition={{ delay: 0.25 + seconds * 0.6, duration: 0.9, ease: EASE }}
              />
            </span>
          </motion.div>

          <div className="home-reveal">
            <motion.div
              className="home-cue"
              inert={horizontal && open}
              style={horizontal ? undefined : { opacity: cueOpacity }}
            >
              <button
                aria-controls={horizontal ? 'home-menu' : undefined}
                aria-expanded={horizontal ? open : undefined}
                className="btn btn--quiet"
                onClick={() => goToMenu(true)}
                type="button"
              >
                {enterLabel}
              </button>
              <span className="type-caption">{scrollCue}</span>
              <span aria-hidden="true" className="home-cue__line" />
            </motion.div>

            {horizontal ? (
              // Focusing a link (Tab past Enter) opens the row too, so keyboard
              // users never land on invisible links.
              <nav aria-label={menuLabel} className="home-hmenu" id="home-menu" ref={menuRef}>
                <div aria-hidden="true" className="home-hmenu__head">
                  <span className="type-label">{menuLabel}</span>
                  <span className="home-menu__count type-meta">
                    {links.length > 0 ? `${links[0]!.index} — ${links[links.length - 1]!.index}` : ''}
                  </span>
                </div>
                <ol className="home-hmenu__list">
                  {links.map((link, index) => (
                    <li className="home-hmenu__item" key={link.href} style={{ '--i': index } as CSSProperties}>
                      <Link
                        aria-current={link.current ? 'page' : undefined}
                        className="menu-row home-hmenu__link"
                        href={link.href}
                        onFocus={() => openRow(false)}
                        rel={link.external ? 'noreferrer' : undefined}
                        target={link.newTab ? '_blank' : undefined}
                      >
                        <span aria-hidden="true" className="home-hmenu__index">
                          {link.index}
                        </span>
                        <svg aria-hidden="true" className="home-hmenu__arrow" fill="none" viewBox="0 0 24 12">
                          <path d="M0 6H23M18 1L23 6L18 11" vectorEffect="non-scaling-stroke" />
                        </svg>
                        <span className="menu-row__label home-hmenu__label">{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}
          </div>
        </div>
      </section>

      {horizontal ? null : (
        <nav aria-label={menuLabel} className="home-menu container-content" id="home-menu" ref={menuRef}>
          <noscript>
            <p className="type-caption mb-3">{menuNoScript}</p>
          </noscript>
          <div className="home-menu__head">
            <span className="type-label">{menuLabel}</span>
            <span aria-hidden="true" className="home-menu__count type-meta">
              {links.length > 0 ? `${links[0]!.index} — ${links[links.length - 1]!.index}` : ''}
            </span>
          </div>
          <ol className="home-menu__list">
            {links.map((link, index) => (
              <motion.li
                className="home-row"
                initial={reduced ? false : 'hidden'}
                key={link.href}
                transition={{ delay: 0.07 * index, duration: 0.7, ease: EASE }}
                variants={{ hidden: { opacity: 0, y: 18 }, shown: { opacity: 1, y: 0 } }}
                viewport={{ amount: 0.6, once: true }}
                whileInView="shown"
              >
                <motion.span
                  aria-hidden="true"
                  className="home-row__rule"
                  initial={reduced ? false : { scaleX: 0 }}
                  transition={{ delay: 0.07 * index, duration: 0.9, ease: EASE }}
                  viewport={{ amount: 0.6, once: true }}
                  whileInView={{ scaleX: 1 }}
                />
                <Link
                  aria-current={link.current ? 'page' : undefined}
                  className="menu-row home-row__link"
                  href={link.href}
                  rel={link.external ? 'noreferrer' : undefined}
                  target={link.newTab ? '_blank' : undefined}
                >
                  <span aria-hidden="true" className="home-row__index">
                    {link.index}
                  </span>
                  <span className="menu-row__label home-row__label">{link.label}</span>
                  <span aria-hidden="true" className="home-row__leader" />
                  <svg aria-hidden="true" className="home-row__arrow" fill="none" viewBox="0 0 24 12">
                    <path d="M0 6H23M18 1L23 6L18 11" vectorEffect="non-scaling-stroke" />
                  </svg>
                </Link>
              </motion.li>
            ))}
          </ol>
          {links.length > 0 ? (
            <motion.span
              aria-hidden="true"
              className="home-row__rule home-row__rule--closing"
              initial={reduced ? false : { scaleX: 0 }}
              transition={{ delay: 0.07 * links.length, duration: 0.9, ease: EASE }}
              viewport={{ amount: 0.6, once: true }}
              whileInView={{ scaleX: 1 }}
            />
          ) : null}
        </nav>
      )}

      {/* Motion renders initial states on the server; without scripting they would
          stay hidden forever. Browsers with scripting on never apply this block. */}
      <noscript>
        <style>
          {'.stage-intro-fx,.home-row,.home-logo,.home-cue{opacity:1 !important;transform:none !important;clip-path:none !important;filter:none !important}.home-row__rule{transform:none !important}.home-hmenu,.home-hmenu__item{opacity:1 !important;clip-path:none !important;pointer-events:auto !important}.home-intro--horizontal .home-cue{display:none !important}'}
        </style>
      </noscript>
    </main>
  )
}
