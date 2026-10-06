import type { Metadata } from 'next'

import { getSiteOrNull } from '@/lib/cms/endpoints'
import { ContentContainer } from '@/components/design/Container'
import { Rule } from '@/components/design/Rule'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { labels as dictionary } from '@/lib/theme/labels'
import { NotFoundBody } from '@/components/states/States'
import { headers } from 'next/headers'
import type { Locale } from '@/lib/cms/types'
import { brandName } from '@/lib/theme/brand'

/**
 * The 404 body. `src/proxy.ts` rewrites unknown paths here with an explicit `404`
 * status, so the response is a real 404 carrying the designed page instead of a
 * streamed 200 shell. The route is never linked and always `noindex`.
 */
/**
 * A page-level *static* `metadata` export merged its `robots` but lost its `title` to the
 * root layout, so every unknown URL was titled with the studio name alone. Dynamic
 * metadata — what every other route in this theme uses — resolves as expected.
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const headerList = await headers()
  const locale: Locale = headerList.get('x-arch-locale') === 'en' ? 'en' : 'fa'
  const site = await getSiteOrNull()
  const title = dictionary(locale).notFoundTitle
  return {
    robots: { follow: false, index: false },
    title: site ? `${title} — ${brandName(site)}` : title,
  }
}

export default async function NotFoundRoute() {
  const headerList = await headers()
  const locale: Locale = headerList.get('x-arch-locale') === 'en' ? 'en' : 'fa'
  const t = dictionary(locale)

  return (
    <main className="flex min-h-svh flex-1 flex-col justify-center" id="content">
      <ContentContainer className="py-24">
        <Rule className="mb-10 max-w-[10rem]" tone="decor" />
        <h1 className="type-title max-w-[24ch]">{t.notFoundTitle}</h1>
        <p className="type-body mt-4 max-w-[46ch] text-ink-secondary">{t.notFoundBody}</p>
        <NotFoundBody>
          <a className="link-inline type-ui target-standalone" href={href(THEME_ROUTES.home, locale, { defaultLocale: 'fa' })}>
            {t.home}
          </a>
        </NotFoundBody>
      </ContentContainer>
    </main>
  )
}
