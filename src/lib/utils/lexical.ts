import type { LexicalNode } from '@/lib/cms/types'

/** Flattens a lexical tree to plain text — used only for honest reading-time counts. */
export const lexicalText = (content: null | { root?: { children?: LexicalNode[] } }): string => {
  const walk = (node: LexicalNode): string => {
    const own = typeof node.text === 'string' ? node.text : ''
    const children = (node.children ?? []).map(walk).join(' ')
    return `${own} ${children}`
  }
  return (content?.root?.children ?? []).map(walk).join(' ').replace(/\s+/gu, ' ').trim()
}

/** Media uploaded inside a rich-text field (inline `upload` and `mediaBlock` nodes). */
export const collectMedia = (
  content: null | { root?: { children?: LexicalNode[] } },
): { alt?: null | string; height?: null | number; id: string; url?: null | string; width?: null | number }[] => {
  const found: { alt?: null | string; height?: null | number; id: string; url?: null | string; width?: null | number }[] = []
  const visit = (node: LexicalNode): void => {
    const fields = (node.fields ?? {}) as Record<string, unknown>
    // `upload` nodes, `mediaBlock.media`, and every image of a `mediaGrid` block.
    const candidates = node.type === 'upload' ? [node.value] : [fields.media, ...(Array.isArray(fields.images) ? fields.images : [])]
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && 'id' in (candidate as Record<string, unknown>)) {
        const media = candidate as { id: string; alt?: null | string; url?: null | string; width?: null | number; height?: null | number }
        if (media.url) found.push(media)
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  for (const child of content?.root?.children ?? []) visit(child)
  return found
}
