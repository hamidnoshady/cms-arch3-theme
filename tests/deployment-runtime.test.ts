import { createServer } from 'node:http'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET as health } from '@/app/api/health/route'
import { GET as proxyGet, POST as proxyPost } from '@/app/api/[...path]/route'
import { cachedCmsRead, clearCmsReadCache, purgeCmsReadCache } from '@/lib/cms/cache'

const ENV = { ...process.env }

afterEach(() => {
  clearCmsReadCache()
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

const response = (body: string, status = 200) => ({
  body,
  headers: new Headers({ 'content-type': 'application/json' }),
  status,
})

describe('deployment readiness and CMS cache', () => {
  it('answers health directly without a CMS read or redirect', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    process.env.ESHOBE_CMS_URL = 'https://cms.example.test'

    const result = health()
    expect(result.status).toBe(200)
    expect(result.headers.get('cache-control')).toBe('no-store')
    await expect(result.json()).resolves.toEqual({ ok: true, status: 'ok' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reuses a successful CMS read, then purges resources and the site descriptor together', async () => {
    let calls = 0
    const load = async () => response(JSON.stringify({ value: ++calls }))

    await cachedCmsRead({ key: 'site', load, path: '/api/site', tags: ['cms:site:site'] })
    await cachedCmsRead({ key: 'page', load, path: '/api/pages', tags: ['cms:site:pages:fa'] })
    await cachedCmsRead({ key: 'page', load, path: '/api/pages', tags: ['cms:site:pages:fa'] })
    expect(calls).toBe(2)

    expect(purgeCmsReadCache({ resources: ['page'] })).toBe(2)
    await cachedCmsRead({ key: 'site', load, path: '/api/site', tags: ['cms:site:site'] })
    await cachedCmsRead({ key: 'page', load, path: '/api/pages', tags: ['cms:site:pages:fa'] })
    expect(calls).toBe(4)
  })
})

describe('direct-mode API proxy', () => {
  it('proxies documented CMS reads with the original customer Host and caches GETs', async () => {
    const seen: { host?: string; url?: string; xForwardedHost?: string }[] = []
    const cms = createServer((request, response) => {
      const forwarded = request.headers['x-forwarded-host']
      seen.push({
        host: request.headers.host,
        url: request.url,
        xForwardedHost: Array.isArray(forwarded) ? forwarded[0] : forwarded,
      })
      response.setHeader('content-type', 'application/json')
      response.end('{"docs":[]}')
    })
    await new Promise<void>((resolve) => cms.listen(0, '127.0.0.1', resolve))
    const address = cms.address()
    if (!address || typeof address === 'string') throw new Error('test CMS did not expose a TCP port')
    process.env.ESHOBE_CMS_URL = `http://127.0.0.1:${address.port}`

    try {
      const request = () =>
        new Request('https://customer.example/api/products?limit=2', {
          headers: { host: 'customer.example' },
        })
      const context = { params: Promise.resolve({ path: ['products'] }) }

      await proxyGet(request(), context)
      await proxyGet(request(), context)

      expect(seen).toEqual([
        { host: 'customer.example', url: '/api/products?limit=2', xForwardedHost: 'customer.example' },
      ])
    } finally {
      await new Promise<void>((resolve, reject) => cms.close((error) => (error ? reject(error) : resolve())))
    }
  })

  it('forwards public checkout POSTs but does not cache them', async () => {
    const calls: { body: string; host?: string; url?: string }[] = []
    const cms = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        calls.push({ body: Buffer.concat(chunks).toString('utf8'), host: request.headers.host, url: request.url })
        response.setHeader('content-type', 'application/json')
        response.end('{"ok":true}')
      })
    })
    await new Promise<void>((resolve) => cms.listen(0, '127.0.0.1', resolve))
    const address = cms.address()
    if (!address || typeof address === 'string') throw new Error('test CMS did not expose a TCP port')
    process.env.ESHOBE_CMS_URL = `http://127.0.0.1:${address.port}`

    try {
      const context = { params: Promise.resolve({ path: ['checkout'] }) }
      const request = () =>
        new Request('https://customer.example/api/checkout', {
          body: '{"product":"product-id"}',
          headers: { 'content-type': 'application/json', host: 'customer.example' },
          method: 'POST',
        })

      await proxyPost(request(), context)
      await proxyPost(request(), context)

      expect(calls).toEqual([
        { body: '{"product":"product-id"}', host: 'customer.example', url: '/api/checkout' },
        { body: '{"product":"product-id"}', host: 'customer.example', url: '/api/checkout' },
      ])
    } finally {
      await new Promise<void>((resolve, reject) => cms.close((error) => (error ? reject(error) : resolve())))
    }
  })
})
