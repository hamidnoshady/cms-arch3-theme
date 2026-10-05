import 'server-only'

import { createHash } from 'node:crypto'

import { cachedCmsRead, type CachedCmsResponse } from './cache'
import { fixtureRaw, fixturesEnabled } from './fixtures'
import type { SiteDescriptor } from './types'

/**
 * The server-only CMS client.
 *
 * ## Tenant identity
 * The theme never accepts a tenant from a visitor: the site is whatever
 * `ESHOBE_SITE_DOMAIN`/`ESHOBE_SITE_ID` the platform injected, and every read carries
 * `Authorization: Bearer $ESHOBE_API_KEY` (a `role: "site"` credential — the key *is*
 * the tenant, not a filter).
 *
 * ## Why there is no Host rewriting here
 * `docs/THEME_API.md` §3 is explicit that a deployed theme must use the key rather
 * than forge the customer's `Host`: behind the same proxy, rewriting `Host` sends the
 * request back into the theme's own container. There is a second, verified reason:
 * **Node's `fetch` ignores a `Host` header you set** (undici derives it from the URL),
 * so a Host-based read cannot be expressed with `fetch` at all. The direct API proxy
 * and opt-in local host-tenant development therefore use `requestWithHost()` — a
 * `node:http(s)` request that can set the header. Server-side content reads use it only
 * when `ESHOBE_ALLOW_HOST_TENANT=true`.
 */

export class CmsError extends Error {
  readonly status: number
  readonly path: string

  constructor(path: string, status: number, message: string) {
    // The API key is never interpolated into an error, log or thrown message.
    super(`CMS ${status} for ${path}: ${message}`)
    this.name = 'CmsError'
    this.path = path
    this.status = status
  }
}

export type QueryValue =
  | boolean
  | null
  | number
  | QueryValue[]
  | string
  | undefined
  | { [key: string]: QueryValue }

export type QueryParams = Record<string, QueryValue>

/** Payload's `where[slug][equals]=x` syntax, built without a query-string library. */
export const toQueryString = (params: QueryParams): string => {
  const parts: string[] = []
  const append = (key: string, value: QueryValue): void => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((entry, index) => append(`${key}[${index}]`, entry))
      return
    }
    if (typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) append(`${key}[${childKey}]`, childValue)
      return
    }
    parts.push(`${key}=${encodeURIComponent(String(value))}`)
  }
  for (const [key, value] of Object.entries(params)) append(key, value)
  return parts.join('&')
}

export type CmsEnv = {
  apiKey: null | string
  allowHostTenant: boolean
  cmsUrl: null | string
  defaultLocale: null | string
  hasCms: boolean
  publicOrigin: null | string
  siteDomain: null | string
  siteId: null | string
  /** Stable tenant key for cache-tag partitioning; never a secret. */
  tenantKey: string
}

const first = (...values: (null | string | undefined)[]): null | string =>
  values.find((value) => typeof value === 'string' && value.length > 0) ?? null

export const cmsEnv = (): CmsEnv => {
  // Normalised once, here: every caller may then join paths without worrying about a
  // trailing slash (and the env value is never logged or exposed to the browser).
  const cmsUrl = first(process.env.ESHOBE_CMS_URL, process.env.ESHOBE_API_URL)?.replace(/\/+$/, '') ?? null
  const apiKey = first(process.env.ESHOBE_API_KEY, process.env.ESHOBE_SITE_API_KEY)
  const siteDomain = first(process.env.ESHOBE_SITE_DOMAIN)
  const siteId = first(process.env.ESHOBE_SITE_ID)
  const allowHostTenant =
    process.env.ESHOBE_ALLOW_HOST_TENANT === 'true' && Boolean(siteDomain) && !apiKey

  return {
    apiKey,
    allowHostTenant,
    cmsUrl,
    defaultLocale: first(process.env.ESHOBE_DEFAULT_LOCALE),
    hasCms: Boolean(cmsUrl),
    publicOrigin: first(process.env.ESHOBE_PUBLIC_ORIGIN),
    siteDomain,
    siteId,
    tenantKey: siteId ?? siteDomain ?? 'unbound',
  }
}

/** Cache tag for a tenant-scoped, locale-scoped CMS read. */
export const cmsTag = (env: CmsEnv, resource: string, locale?: null | string): string =>
  `cms:${env.tenantKey}:${resource}${locale ? `:${locale}` : ''}`

export type CmsFetchOptions = {
  /** Draft reads need the site key; they are never shared-cached. */
  draft?: boolean
  locale?: null | string
  params?: QueryParams
  revalidate?: number
  tags?: string[]
}

export type RawResponse = CachedCmsResponse

/**
 * Host-preserving native request. `node:http(s)` is the only reliable way to set Host:
 * server-side content reads use it only for opt-in, key-less local development, while
 * the direct public API proxy uses it to preserve the customer's tenant host. Callers
 * must never combine a site credential with a visitor-provided Host.
 */
export const requestWithHost = async (
  url: string,
  host: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<RawResponse> => {
  const target = new URL(url)
  const transport = target.protocol === 'https:' ? await import('node:https') : await import('node:http')

  return new Promise<RawResponse>((resolve, reject) => {
    const request = transport.request(
      {
        headers: { ...init.headers, host, accept: 'application/json' },
        hostname: target.hostname,
        method: init.method ?? 'GET',
        path: `${target.pathname}${target.search}`,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        protocol: target.protocol,
        // CMS reads fail after a short bound so an older in-process value can keep
        // rendering instead of tying up a request during an upstream outage.
        timeout: 5000,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            headers: new Headers(
              Object.entries(response.headers).flatMap(([key, value]) =>
                typeof value === 'string' ? [[key, value] as [string, string]] : [],
              ),
            ),
            status: response.statusCode ?? 500,
          }),
        )
      },
    )
    request.on('timeout', () => request.destroy(new Error('CMS request timed out')))
    request.on('error', reject)
    if (init.body) request.write(init.body)
    request.end()
  })
}

export const cmsFetchRaw = async (
  path: string,
  options: CmsFetchOptions = {},
  init: { method?: 'GET' | 'POST'; body?: string; headers?: Record<string, string> } = {},
): Promise<RawResponse> => {
  const method = init.method ?? 'GET'
  const env = cmsEnv()
  const query = options.params ? toQueryString(options.params) : ''
  const cachePath = `${path}${query ? `?${query}` : ''}`

  const load = async (): Promise<RawResponse> => {
    // Development fixtures come first so the whole theme can render without a CMS. The
    // guard lives inside `fixturesEnabled()` (never production, never implicit).
    if (method === 'GET' && fixturesEnabled()) {
      const fixture = await fixtureRaw(path, options.params)
      return { body: fixture.body, headers: new Headers({ 'content-type': 'application/json' }), status: fixture.status }
    }

    if (!env.cmsUrl) throw new CmsError(path, 503, 'ESHOBE_CMS_URL is not configured')

    const url = `${env.cmsUrl.replace(/\/$/, '')}${cachePath}`
    const headers: Record<string, string> = { accept: 'application/json', ...init.headers }
    if (env.apiKey) headers.authorization = `Bearer ${env.apiKey}`

    if (env.allowHostTenant && env.siteDomain) {
      return requestWithHost(url, env.siteDomain, { body: init.body, headers, method })
    }

    const response = await fetch(url, {
      body: init.body,
      // `GET /api/site` with a site key is explicitly `private, no-store`. The
      // application cache below is tenant-partitioned and owns expiry/stale fallback;
      // do not let Next's shared data cache retain a credentialed response.
      cache: 'no-store',
      headers,
      method,
      signal: AbortSignal.timeout(5000),
    })

    return { body: await response.text(), headers: response.headers, status: response.status }
  }

  // Drafts and writes are never shared. All public reads (site/pages/posts/products/
  // categories and future documented endpoints) share the same bounded in-memory
  // cache, keyed by complete path/query and the trusted deployment tenant.
  if (method !== 'GET' || options.draft) return load()
  return cachedCmsRead({
    key: `cms:${env.cmsUrl ?? 'fixtures'}:${env.tenantKey}:${env.allowHostTenant ? env.siteDomain ?? '' : 'key'}:${cachePath}`,
    load,
    path,
    tags: options.tags,
  })
}

const parse = <T>(path: string, raw: RawResponse): T => {
  if (raw.status >= 400) {
    throw new CmsError(path, raw.status, raw.body.slice(0, 200) || 'no body')
  }
  try {
    return JSON.parse(raw.body) as T
  } catch {
    throw new CmsError(path, raw.status, 'response was not JSON')
  }
}

export const cmsFetch = async <T>(path: string, options: CmsFetchOptions = {}): Promise<T> =>
  parse<T>(path, await cmsFetchRaw(path, options))

/** `null` for a 404 (a missing optional document), every other failure still throws. */
export const cmsFetchOptional = async <T>(
  path: string,
  options: CmsFetchOptions = {},
): Promise<null | T> => {
  const raw = await cmsFetchRaw(path, options)
  if (raw.status === 404) return null
  return parse<T>(path, raw)
}

export const isLocaleServed = (site: Pick<SiteDescriptor, 'availableLocales'>, locale: string): boolean =>
  site.availableLocales.includes(locale as SiteDescriptor['availableLocales'][number])

/** Lifecycle gate: `suspended`/`archived` sites serve a holding page, never content. */
export const isSiteServing = (site: Pick<SiteDescriptor, 'status'>): boolean => site.status === 'active'

/** Stable, non-secret fingerprint used in cache tags and diagnostics. */
export const fingerprint = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 12)
