import type { LexicalNode, Media } from '@/lib/cms/types'

import { lightboxItem, type LightboxItem } from './media'

/** Flattens a lexical tree to plain text — used only for honest reading-time counts. */
export const lexicalText = (content: null | { root?: { children?: LexicalNode[] } }): string => {
  const walk = (node: LexicalNode): string => {
    const own = typeof node.text === 'string' ? node.text : ''
    const children = (node.children ?? []).map(walk).join(' ')
    return `${own} ${children}`
  }
  return (content?.root?.children ?? []).map(walk).join(' ').replace(/\s+/gu, ' ').trim()
}

type LexicalContent = null | { root?: { children?: LexicalNode[] } }

const isMediaObject = (candidate: unknown): candidate is Media =>
  Boolean(candidate) && typeof candidate === 'object' && 'id' in (candidate as Record<string, unknown>)

/**
 * Visits every populated medium in a rich-text tree **in document order**: inline
 * `upload` nodes, a `mediaBlock`'s `media`, and each image of a `mediaGrid`. The
 * callback receives the very object the tree holds, so a caller can key a lookup on
 * identity — the same photograph inserted twice is two occurrences, not one.
 */
export const walkMedia = (content: LexicalContent, visit: (media: Media) => void): void => {
  const visitNode = (node: LexicalNode): void => {
    const fields = (node.fields ?? {}) as Record<string, unknown>
    const candidates =
      node.type === 'upload' ? [node.value] : [fields.media, ...(Array.isArray(fields.images) ? fields.images : [])]
    for (const candidate of candidates) {
      if (isMediaObject(candidate)) visit(candidate)
    }
    for (const child of node.children ?? []) visitNode(child)
  }
  for (const child of content?.root?.children ?? []) visitNode(child)
}

/**
 * The lightbox sequence of one rich-text field: every content image in document
 * order, plus a lookup from the medium *object* to its index so the renderer can wire
 * each frame to its position without a mutable counter across the render. `null` when
 * the field has no image that resolves to a file, so prose without photographs gets no
 * client component at all.
 */
export type ContentLightbox = { indexOf: WeakMap<object, number>; items: LightboxItem[] }

export const contentLightbox = (content: LexicalContent, origin: string, fallbackAlt: string): ContentLightbox | null => {
  const items: LightboxItem[] = []
  const indexOf = new WeakMap<object, number>()
  walkMedia(content, (media) => {
    if (!('url' in media)) return
    const item = lightboxItem(media, origin, fallbackAlt)
    if (!item) return
    indexOf.set(media, items.length)
    items.push(item)
  })
  return items.length > 0 ? { indexOf, items } : null
}

/** Media uploaded inside a rich-text field that resolve to a file (have a `url`). */
export const collectMedia = (
  content: LexicalContent,
): { alt?: null | string; height?: null | number; id: string; url?: null | string; width?: null | number }[] => {
  const found: Media[] = []
  walkMedia(content, (media) => {
    if (media.url) found.push(media)
  })
  return found
}

/**
 * One entry of a long article's table of contents: a section heading (`level` 1) or a
 * named media grid / sub-heading inside a section (`level` 2). `id` is the anchor the
 * renderer puts on the node and the in-page navigation links to — derived from the
 * entry's position only, so the renderer and the navigation compute the same ids
 * independently from the same content.
 */
export type OutlineItem = { id: string; label: string; level: 1 | 2; node: LexicalNode }

const outlineLevel = (node: LexicalNode): { label: string; level: 1 | 2 } | null => {
  if (node.type === 'heading') {
    const label = lexicalText({ root: { children: [node] } })
    if (!label) return null
    return { label, level: ['h3', 'h4', 'h5', 'h6'].includes(node.tag as string) ? 2 : 1 }
  }
  if (node.type === 'block' || node.type === 'blocknode') {
    const fields = (node.fields ?? {}) as Record<string, unknown>
    const name = fields.blockName ?? (node as unknown as Record<string, unknown>).blockName
    if (fields.blockType === 'mediaGrid' && typeof name === 'string' && name.trim()) {
      return { label: name.trim(), level: 2 }
    }
  }
  return null
}

/** Top-level headings and named media grids, in document order, each with its anchor id. */
export const contentOutline = (content: LexicalContent): OutlineItem[] => {
  const items: OutlineItem[] = []
  for (const node of content?.root?.children ?? []) {
    const entry = outlineLevel(node)
    if (entry) items.push({ ...entry, id: `section-${items.length + 1}`, node })
  }
  return items
}
