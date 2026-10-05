import { NextResponse } from 'next/server'

import { cmsEnv, requestWithHost } from '@/lib/cms/client'
import { fixturesEnabled } from '@/lib/cms/fixtures'

export const dynamic = 'force-dynamic'

/**
 * Public form submissions, proxied to the CMS.
 *
 * The visitor's request is forwarded with **the original `Host` header** (the CMS
 * derives the site from the form document, but it still resolves the tenant from the
 * host/key pair) and with **no site API key** — a public enquiry must never be filed
 * with a privileged credential. Cookies and any client-supplied `authorization` are
 * stripped before forwarding. Body size is bounded so the theme cannot be used as a
 * bulk relay into the CMS.
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

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload-too-large' }, { status: 413 })
  }

  const target = `${env.cmsUrl.replace(/\/$/, '')}/api/form-submissions`
  const host = request.headers.get('host')
  const headers = {
    'content-type': request.headers.get('content-type') ?? 'application/json',
    ...(host ? { 'x-forwarded-host': host } : {}),
  }

  try {
    // Node's fetch derives Host from the upstream URL. The native client is the only
    // safe way to preserve the customer Host that the CMS uses for tenant resolution.
    if (host) {
      const response = await requestWithHost(target, host, { body: raw, headers, method: 'POST' })
      return new NextResponse(response.body, {
        headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
        status: response.status,
      })
    }

    const response = await fetch(target, {
      body: raw,
      cache: 'no-store',
      headers,
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
    return new NextResponse(await response.text(), {
      headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
      status: response.status,
    })
  } catch {
    return NextResponse.json({ error: 'cms-unavailable' }, { headers: { 'cache-control': 'no-store' }, status: 503 })
  }
}
