import { NextResponse } from 'next/server'

import { cachedCmsRead } from '@/lib/cms/cache'
import { cmsEnv, requestWithHost } from '@/lib/cms/client'

export const dynamic = 'force-dynamic'

/**
 * CMS-owned public paths for direct/Coolify deployments. Customer DNS terminates at the
 * theme container, so these routes must be relayed to the CMS with the visitor's
 * original Host intact. Theme-owned `/api/health` and `/api/revalidate` have concrete
 * route handlers and therefore never reach this catch-all route.
 */
const ALLOWED_EXACT = new Set([
  'categories',
  'footer',
  'forms',
  'header',
  'media',
  'pages',
  'posts',
  'products',
  'redirects',
  'search',
  'site',
  'store',
  'theme',
])

const ALLOWED_PREFIXES = ['checkout', 'media/file', 'payments']
const FORWARDED_METHODS = new Set(['GET', 'HEAD', 'POST'])

const isAllowed = (segments: string[]): boolean => {
  if (segments.length === 0) return false
  const joined = segments.join('/')
  if (ALLOWED_EXACT.has(joined)) return true
  return ALLOWED_PREFIXES.some((prefix) => joined === prefix || joined.startsWith(`${prefix}/`))
}

const responseHeaders = (upstream: Headers): Headers => {
  const headers = new Headers()
  for (const name of ['cache-control', 'content-type', 'etag', 'last-modified', 'location', 'vary']) {
    const value = upstream.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('x-content-type-options', 'nosniff')
  return headers
}

const forward = async (request: Request, segments: string[]): Promise<Response> => {
  const env = cmsEnv()
  if (!env.cmsUrl) return NextResponse.json({ error: 'cms-unconfigured' }, { status: 503 })
  if (!FORWARDED_METHODS.has(request.method)) {
    return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 })
  }
  if (!isAllowed(segments)) {
    return NextResponse.json({ error: 'path-not-proxied' }, { status: 403 })
  }

  const cms = new URL(env.cmsUrl)
  const incoming = new URL(request.url)
  if (cms.host === incoming.host) {
    return NextResponse.json({ error: 'proxy-recursion-refused' }, { status: 508 })
  }

  const path = `/api/${segments.join('/')}`
  const target = new URL(`${cms.origin}${path}`)
  target.search = incoming.search
  const host = request.headers.get('host')
  // Cache GET only: a HEAD response has no body and must never populate a later GET.
  const isRead = request.method === 'GET'
  const body = isRead ? undefined : await request.text()
  const requestHeaders = {
    accept: request.headers.get('accept') ?? 'application/json',
    ...(request.headers.get('content-type') ? { 'content-type': request.headers.get('content-type') as string } : {}),
    ...(host ? { 'x-forwarded-host': host } : {}),
  }

  const load = async () => {
    try {
      // Undici deliberately derives Host from the URL and ignores a `fetch` Host
      // header. Use node:http(s) when there is an incoming Host so the CMS receives
      // the customer domain it uses as tenant authority.
      if (host) {
        const upstream = await requestWithHost(target.toString(), host, {
          body,
          headers: requestHeaders,
          method: request.method,
        })
        return { body: upstream.body, headers: responseHeaders(upstream.headers), status: upstream.status }
      }

      const upstream = await fetch(target, {
        body,
        cache: 'no-store',
        headers: requestHeaders,
        method: request.method,
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      })
      return { body: await upstream.text(), headers: responseHeaders(upstream.headers), status: upstream.status }
    } catch {
      return {
        body: JSON.stringify({ error: 'cms-unavailable' }),
        headers: new Headers({ 'content-type': 'application/json' }),
        status: 503,
      }
    }
  }

  const upstream = isRead
    ? await cachedCmsRead({
        key: `proxy:${cms.origin}:${host ?? 'no-host'}:${path}${incoming.search}`,
        load,
        path,
        tags: [`proxy:${host ?? 'no-host'}:${segments[0] ?? 'api'}`],
      })
    : await load()

  return new NextResponse(request.method === 'HEAD' ? null : upstream.body, {
    headers: upstream.headers,
    status: upstream.status,
  })
}

type Context = { params: Promise<{ path?: string[] }> }

export const GET = async (request: Request, context: Context): Promise<Response> => {
  const { path = [] } = await context.params
  return forward(request, path)
}

export const HEAD = async (request: Request, context: Context): Promise<Response> => {
  const { path = [] } = await context.params
  return forward(request, path)
}

export const POST = async (request: Request, context: Context): Promise<Response> => {
  const { path = [] } = await context.params
  return forward(request, path)
}
