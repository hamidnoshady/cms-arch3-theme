import { NextResponse } from 'next/server'

import { cmsEnv, relayIdentity, requestWithHost, THEME_PROXY_MARKER } from '@/lib/cms/client'
import { fixturesEnabled } from '@/lib/cms/fixtures'
import { readBoundedText } from '@/lib/http/body'

export const dynamic = 'force-dynamic'

/**
 * Public form submissions, proxied to the CMS.
 *
 * The site is named the same way every other relayed request names it
 * (`relayIdentity`): by the site key when one is configured — the visitor's host then
 * travels only as `x-forwarded-host`, so a preview hostname the CMS does not know
 * still resolves — else by the visitor's own `Host`. The key adds no authority here:
 * the CMS takes the submission's site from the persisted form, and a key is not a user,
 * so the public rate limit still applies. Cookies and any client-supplied
 * `authorization` are never forwarded. Body size is bounded so the theme cannot be
 * used as a bulk relay into the CMS.
 */
const MAX_BODY_BYTES = 64 * 1024

export const POST = async (request: Request) => {
  if (fixturesEnabled()) {
    // Development fixtures: answer like a successful CMS submission so the form's
    // pending/success states can be exercised in a browser without a CMS.
    return NextResponse.json({ message: 'fixture-submission-accepted', ok: true })
  }

  const env = cmsEnv()
  if (!env.cmsUrl) return NextResponse.json({ error: 'cms-unconfigured' }, { status: 503 })
  if (request.headers.get(THEME_PROXY_MARKER)) {
    console.error('[cms-proxy] recursion refused for /api/form-submissions: ESHOBE_CMS_URL routes back to this theme')
    return NextResponse.json({ error: 'proxy-recursion-refused' }, { status: 508 })
  }

  // Bytes, not characters, and enforced while reading (see `readBoundedText`).
  const bounded = await readBoundedText(request, MAX_BODY_BYTES)
  if (!bounded.ok) {
    return NextResponse.json({ error: 'payload-too-large' }, { headers: { 'cache-control': 'no-store' }, status: 413 })
  }
  const raw = bounded.text

  const target = `${env.cmsUrl.replace(/\/$/, '')}/api/form-submissions`
  const relay = relayIdentity(env, request.headers.get('host'))
  const headers = {
    'content-type': request.headers.get('content-type') ?? 'application/json',
    ...relay.headers,
  }

  try {
    // Node's fetch derives Host from the upstream URL. The native client is the only
    // way to send the customer Host that the key-less mode uses for tenant resolution.
    const response = relay.host
      ? await requestWithHost(target, relay.host, { body: raw, headers, method: 'POST' })
      : await fetch(target, {
          body: raw,
          cache: 'no-store',
          headers,
          method: 'POST',
          signal: AbortSignal.timeout(5000),
        }).then(async (upstream) => ({ body: await upstream.text(), status: upstream.status }))
    if (response.status >= 400) console.warn(`[cms-proxy] CMS answered ${response.status} for POST /api/form-submissions`)
    return new NextResponse(response.body, {
      headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
      status: response.status,
    })
  } catch (error) {
    console.error(`[cms-proxy] CMS unreachable for POST /api/form-submissions: ${error instanceof Error ? error.message : String(error)}`)
    return NextResponse.json({ error: 'cms-unavailable' }, { headers: { 'cache-control': 'no-store' }, status: 503 })
  }
}
