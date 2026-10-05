import type { Metadata } from 'next'

import { HomeStage } from '@/components/home/HomeStage'
import { StateView } from '@/views/StateView'
import { getHeader } from '@/lib/cms/endpoints'
import { loadPageContext } from '@/lib/cms/pageContext'
import { navLinks } from '@/lib/routing/nav'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { metadataFor } from '@/lib/seo/metadata'
import { switchTargetsForPath } from '@/lib/seo/translations'
import { labels as dictionary } from '@/lib/theme/labels'
import type { Locale } from '@/lib/cms/types'
import { formatNumber } from '@/lib/runtime'
import { mediaUrl } from '@/lib/utils/media'

/**
 * Home = the entrance stage only: no navbar, no footer, no breadcrumbs, no archive
 * skeletons. What the stage reveals is the CMS header menu.
 */

export const homeMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, '/')
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const ctx = outcome.ctx
  return metadataFor({
    context: ctx,
    description: ctx.site.branding?.tagline ?? null,
    path: '/',
    title: ctx.site.branding?.displayName ?? ctx.site.name,
  })
}

export const HomeView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, '/')
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx

  const header = await getHeader(locale, ctx.draft)
  const links = await navLinks(header?.navItems, ctx, '/')
  const settings = ctx.site.themeRuntime?.settings ?? {}
  const branding = ctx.site.branding
  const t = dictionary(locale)
  const logoMedia = branding?.homeLogo ?? branding?.primaryLogo ?? branding?.logo ?? null
  const logoUrl = mediaUrl(logoMedia, ctx.site.media.origin)
  // Two-digit drafting numbers (۰۱, ۰۲ … / 01, 02 …) through the runtime formatter.
  const indexed = links.map((link, index) => ({
    ...link,
    index: formatNumber(index + 1, locale, { minimumIntegerDigits: 2, useGrouping: false }),
  }))

  // The switch is path-based: the home path is locale-neutral, so `href` applies the
  // prefix exactly once. Pre-prefixing it here produced `/en/en` on the English home.
  return (
    <HomeStage
      dir={ctx.dir}
      enterLabel={t.enter}
      introDuration={typeof settings.introDuration === 'number' ? settings.introDuration : 1200}
      introEnabled={settings.introAnimation !== false}
      links={indexed}
      locale={locale}
      logo={
        logoUrl
          ? { height: logoMedia?.height ?? null, url: logoUrl, width: logoMedia?.width ?? null }
          : null
      }
      menuLabel={t.menuTitle}
      menuNoScript={t.menuNoScript}
      name={branding?.displayName ?? ctx.site.name}
      scrollCue={t.scrollCue}
      switchTargets={switchTargetsForPath(ctx, () => THEME_ROUTES.home)}
    />
  )
}
