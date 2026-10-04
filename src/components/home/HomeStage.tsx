'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import type { SwitchTarget } from '@/lib/seo/translations'

/**
 * The home entrance stage — the one page that is not an interior page.
 *
 * Structure: a white viewport holding the customer's mark, a restrained line draw that
 * plays **once**, and a bounded gesture (wheel, swipe, keyboard or the visible Enter
 * control) that reveals the CMS-driven menu. Nothing else lives here: no hero copy, no
 * project grid, no footer, no archive skeletons.
 *
 * Deliberate behaviour:
 * - **No scroll hijack.** During the intro the stage is exactly one viewport with
 *   `overflow: hidden`, so there is no page scroll to intercept; the wheel/touch
 *   listeners only *choose the phase* and are removed the moment the menu is open.
 * - **The intro does not replay.** Entering the menu writes a `sessionStorage` flag, so
 *   coming back to `/` from an interior page lands directly in the stable menu state.
 *   The back button therefore returns to the previous *page*, never to a mid-animation
 *   intro. (A fresh tab/session sees the entrance once more.)
 * - **The uploaded logo is never inlined.** An SVG from the CMS may contain script as
 *   far as this renderer is concerned; it is always an `<img>`. The "draw" is the
 *   theme's own hairline, which is also the fallback when no logo exists.
 * - Registering the flag is skipped when the customer turns the animation off in theme
 *   settings (`themeRuntime.settings.introAnimation`).
 */

export type HomeStageProps = {
  dir: 'ltr' | 'rtl'
  enterLabel: string
  introDuration: number
  introEnabled: boolean
  locale: 'en' | 'fa'
  logoUrl: null | string
  menuLabel: string
  menuNoScript: string
  name: string
  scrollCue: string
  switchTargets: SwitchTarget[]
  links: { current: boolean; external: boolean; href: string; label: string; newTab: boolean }[]
}

const SESSION_KEY = 'arch2:entered'

/**
 * `sessionStorage` is an external store, so it is read through `useSyncExternalStore`
 * rather than a mount effect: the server snapshot is `false`, hydration re-reads the
 * real value without a cascading render, and storage being unavailable (private mode)
 * simply reports "not entered".
 */

/**
 * The stage's keyboard shortcut must never swallow a control's own key. Links, the
 * Enter button and any other interactive target keep their native behaviour; only
 * presses landing on the stage/background reveal the menu.
 */
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

export const HomeStage = ({
  dir,
  enterLabel,
  introDuration,
  introEnabled,
  logoUrl,
  menuLabel,
  menuNoScript,
  name,
  scrollCue,
  switchTargets,
  links,
}: HomeStageProps) => {
  const reduced = useReducedMotion()
  const remembered = useSyncExternalStore(subscribeStorage, readEntered, () => false)
  const [entered, setEntered] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLElement>(null)
  // Set when the reveal was requested from a control that disappears with the intro
  // (the Enter button) or from the keyboard, so focus can land in the revealed menu.
  const focusMenuOnOpen = useRef(false)

  // Returning to `/` in the same tab, or a site that disabled the intro, lands in the
  // stable menu state without an effect and without a hydration flash of the intro.
  const menuOpen = entered || remembered || !introEnabled

  const enter = useCallback((options?: { focusMenu?: boolean }) => {
    if (options?.focusMenu) focusMenuOnOpen.current = true
    setEntered(true)
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* storage unavailable — behaviour stays correct, just not remembered */
    }
  }, [])

  // The Enter control and the keyboard shortcut unmount the affordances that were
  // focused; hand focus to the first menu destination instead of leaving it on <body>.
  useEffect(() => {
    if (!menuOpen || !focusMenuOnOpen.current) return
    focusMenuOnOpen.current = false
    menuRef.current?.querySelector<HTMLElement>('a[href]')?.focus()
  }, [menuOpen])

  // Bounded gesture handling: only while the intro is on screen.
  useEffect(() => {
    if (menuOpen) return
    const node = stageRef.current
    if (!node) return

    let touchStart = 0
    const onWheel = (event: WheelEvent): void => {
      if (Math.abs(event.deltaY) < 12) return
      enter()
    }
    const onTouchStart = (event: TouchEvent): void => {
      touchStart = event.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (event: TouchEvent): void => {
      const current = event.touches[0]?.clientY ?? touchStart
      if (touchStart - current > 24) enter()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      // A focused link or button owns its keys: Enter on the English link must navigate,
      // Enter on the Enter button must run its own click handler.
      if (isInteractiveTarget(event.target)) return
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault()
        enter({ focusMenu: true })
      }
    }

    node.addEventListener('wheel', onWheel, { passive: true })
    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKeyDown)

    return () => {
      node.removeEventListener('wheel', onWheel)
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [enter, menuOpen])

  const duration = reduced ? 0 : Math.max(0, Math.min(introDuration, 4000)) / 1000
  const fast = reduced ? 0.01 : 0.42

  return (
    <main
      className="stage"
      dir={dir}
      id="content"
      ref={stageRef}
      style={menuOpen ? { minBlockSize: '100svh', overflow: 'visible' } : undefined}
    >
      <div className="shell-navbar flex items-center justify-between pt-6">
        <span className="type-label">{menuOpen ? menuLabel : ''}</span>
        <nav aria-label="language" className="flex items-center gap-4">
          {switchTargets.map((target) =>
            target.href ? (
              <Link className="type-ui nav-link" href={target.href} hrefLang={target.locale} key={target.locale}>
                {target.label}
              </Link>
            ) : (
              <span className="type-ui text-ink-secondary" key={target.locale}>
                {target.label}
              </span>
            ),
          )}
        </nav>
      </div>

      <div className="container-content relative flex flex-1 flex-col justify-center">
        <div className="relative">
          <DecorativeMark className="top-0 hidden md:block" style={{ insetInlineStart: 'calc(var(--gutter) * -0.5)' }} variant="crosshair" />

          <motion.div
            animate={
              menuOpen
                ? { opacity: 1, scale: reduced ? 1 : 0.62, y: reduced ? 0 : -8 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            className="stage-intro-fx flex items-center justify-center"
            initial={false}
            transition={{ duration: fast, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <motion.h1
              animate={{ opacity: 1 }}
              className="stage-intro-fx flex max-w-[26rem] items-center justify-center px-6"
              initial={{ opacity: 0 }}
              transition={{ delay: reduced ? 0 : duration, duration: reduced ? 0 : 0.6 }}
            >
              {logoUrl ? (
                <img alt={name} className="max-h-[38svh] w-auto max-w-full" data-logo="mark" decoding="async" src={logoUrl} />
              ) : (
                // Same QA hook as `Logo`: "the customer has no logo" is a state worth
                // proving (the site-name wordmark appears and no mark is drawn), not
                // something to judge from a picture.
                <span className="navbar__wordmark text-center text-[length:var(--text-title)]" data-logo="wordmark">
                  {name}
                </span>
              )}
            </motion.h1>
          </motion.div>

          {/* The theme's own drawn rule — the only line that animates. */}
          <motion.svg
            animate={{ opacity: 1 }}
            aria-hidden="true"
            className="stage-intro-fx mx-auto mt-8 block w-[min(22rem,70%)]"
            height="1"
            initial={{ opacity: 0 }}
            preserveAspectRatio="none"
            transition={{ duration: reduced ? 0 : 0.4 }}
            viewBox="0 0 200 1"
            width="200"
          >
            <motion.path
              animate={{ pathLength: 1 }}
              d="M0 0.5H200"
              initial={{ pathLength: 0 }}
              stroke="var(--line-structural-color)"
              strokeWidth="1"
              transition={{ delay: reduced ? 0 : 0.15, duration: reduced ? 0 : Math.max(duration, 0.6), ease: 'easeOut' }}
            />
          </motion.svg>
        </div>

        {/* Intro affordances: scroll cue + a real Enter control (never wheel-only). */}
        {!menuOpen ? (
          <div className="mt-10 flex flex-col items-center gap-4">
            <button className="btn btn--quiet" onClick={() => enter({ focusMenu: true })} type="button">
              {enterLabel}
            </button>
            <p className="type-caption">{scrollCue}</p>
            <motion.span
              animate={reduced ? { opacity: 1 } : { opacity: [0.25, 1, 0.25] }}
              aria-hidden="true"
              className="stage-intro-fx block h-8 w-px bg-line-structural"
              transition={reduced ? { duration: 0 } : { duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
            />
          </div>
        ) : null}

        {/*
          Progressive enhancement: the entrance is a JS state change, so without JS the
          page would offer nothing but the mark. A `<noscript>` copy of the same CMS
          links means the home page is still a way into the site — browsers with
          scripting on never render it, and it is not a second menu in the a11y tree.
        */}
        <noscript>
          {/* Framer Motion renders the entrance's *initial* state on the server, so with
              scripting off the logo, the drawn rule and the scroll cue would stay at
              `opacity: 0` forever. Browsers with scripting on never apply this block. */}
          <style>{'.stage-intro-fx{opacity:1 !important;transform:none !important}'}</style>
          <nav className="container-content pb-16" aria-label={menuLabel}>
            <p className="type-caption mb-3">{menuNoScript}</p>
            <Rule className="mb-2" />
            <ul>
              {links.map((link) => (
                <li className="relative border-b border-line-structural" key={link.href}>
                  <a className="menu-row flex items-baseline justify-between gap-6 py-5 ps-6" href={link.href}>
                    <span className="menu-row__label type-heading">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </noscript>
      </div>

      {menuOpen ? (
        <motion.nav
          animate={{ opacity: 1 }}
          aria-label={menuLabel}
          className="container-content pb-16"
          initial={{ opacity: 0 }}
          ref={menuRef}
          transition={{ duration: fast }}
        >
          <Rule className="mb-2" />
          <ul>
            {links.map((link, index) => (
              <motion.li
                animate={{ opacity: 1, y: 0 }}
                className="relative border-b border-line-structural"
                initial={{ opacity: 0, y: 8 }}
                key={link.href}
                transition={{ delay: reduced ? 0 : 0.06 * index, duration: fast, ease: [0.22, 0.61, 0.36, 1] }}
              >
                <DecorativeMark className="top-1/2 -translate-y-1/2 hidden md:block" style={{ insetInlineStart: 0 }} variant="dash" />
                <Link
                  aria-current={link.current ? 'page' : undefined}
                  className="menu-row flex items-baseline justify-between gap-6 py-5 ps-6"
                  href={link.href}
                  rel={link.external ? 'noreferrer' : undefined}
                  target={link.newTab ? '_blank' : undefined}
                >
                  <span className="menu-row__label type-heading">{link.label}</span>
                  {/* A line mark, not a glyph: the corner fragment is mirrored in RTL so
                      the elbow always points along the reading direction's forward axis. */}
                  <span className="menu-row__mark">
                    <DecorativeMark variant="corner" />
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
          {links.length === 0 ? <Rule className="mt-2" /> : null}
        </motion.nav>
      ) : null}
    </main>
  )
}
