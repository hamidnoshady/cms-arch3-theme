import Link from 'next/link'
import type { ReactNode } from 'react'

import { FramedMedia } from '@/components/media/CmsImage'
import type { SiteContext } from '@/lib/cms/context'
import type { LexicalNode, Media } from '@/lib/cms/types'
import { cn } from '@/lib/utils/cn'
import { isMedia } from '@/lib/utils/media'
import { resolveRichTextLinks } from '@/lib/routing/richText'

import { renderBlockNode } from './node'

/**
 * Lexical renderer for CMS rich text.
 *
 * Direction is taken from the **field** (`root.direction`), falling back to the page
 * locale — an English quotation inside a Persian page keeps its own direction. Text
 * runs use `unicode-bidi: plaintext` (`.bidi-isolate`) so a Latin product name inside
 * a Persian sentence does not drag the punctuation to the wrong end.
 */
export const RichText = async ({
  className,
  content,
  context,
  fallbackDir,
}: {
  className?: string
  content: null | { root?: { children?: LexicalNode[]; direction?: 'ltr' | 'rtl' | null } }
  context: SiteContext
  fallbackDir: 'ltr' | 'rtl'
}) => {
  const children = content?.root?.children ?? []
  if (children.length === 0) return null
  const direction = content?.root?.direction ?? fallbackDir
  const links = await resolveRichTextLinks(content, context)

  return (
    <div className={cn('prose', className)} dir={direction}>
      {children.map((node, index) => (
        <Node context={context} key={nodeKey(node, index)} links={links} node={node} />
      ))}
    </div>
  )
}

const nodeKey = (node: LexicalNode, index: number): string =>
  typeof node.text === 'string' ? `${node.type ?? 'text'}-${index}-${node.text.slice(0, 12)}` : `${node.type ?? 'node'}-${index}`

const Node = ({
  context,
  links,
  node,
}: {
  context: SiteContext
  links: Map<string, { href: string; newTab: boolean }>
  node: LexicalNode
}): ReactNode => {
  switch (node.type) {
    case 'paragraph':
      return <p>{childrenOf(node, context, links)}</p>

    case 'heading': {
      const tag = (node.tag as string | undefined) ?? 'h2'
      const Tag = (['h2', 'h3', 'h4', 'h5', 'h6'].includes(tag) ? tag : 'h2') as 'h2'
      return <Tag>{childrenOf(node, context, links)}</Tag>
    }

    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul'
      return <Tag>{childrenOf(node, context, links)}</Tag>
    }

    case 'listitem':
      return <li>{childrenOf(node, context, links)}</li>

    case 'quote':
      return <blockquote>{childrenOf(node, context, links)}</blockquote>

    case 'horizontalrule':
      return <hr />

    case 'linebreak':
      return <br />

    case 'link': {
      const fields = (node.fields ?? {}) as Record<string, unknown>
      const doc = fields.doc as { relationTo?: string; value?: string } | undefined
      const resolved = doc?.value ? links.get(`${doc.relationTo ?? 'pages'}:${doc.value}`) : undefined
      const url =
        resolved?.href ??
        (typeof fields.url === 'string' ? fields.url : undefined) ??
        '#'
      const newTab = Boolean(fields.newTab) || resolved?.newTab
      const external = /^https?:\/\//u.test(url)
      if (external || newTab) {
        return (
          <a href={url} rel="noreferrer" target={newTab ? '_blank' : undefined}>
            {childrenOf(node, context, links)}
          </a>
        )
      }
      return <Link href={url}>{childrenOf(node, context, links)}</Link>
    }

    case 'upload': {
      const value = node.value as Media | null | undefined
      if (isMedia(value)) {
        return (
          <FramedMedia cap={70} media={value} origin={context.site.media.origin} size="content" />
        )
      }
      return null
    }

    case 'block':
    case 'blocknode':
      return renderBlockNode(node, context)

    case 'text': {
      return <span className="bidi-isolate">{formatText(node)}</span>
    }

    default:
      return node.children ? <>{childrenOf(node, context, links)}</> : null
  }
}

const childrenOf = (
  node: LexicalNode,
  context: SiteContext,
  links: Map<string, { href: string; newTab: boolean }>,
): ReactNode =>
  (node.children ?? []).map((child, index) => (
    <Node context={context} key={nodeKey(child, index)} links={links} node={child} />
  ))

/** Lexical stores emphasis as a bitmask on the text node. */
const formatText = (node: LexicalNode): ReactNode => {
  const text = node.text ?? ''
  const format = typeof node.format === 'number' ? node.format : 0
  let output: ReactNode = text
  if (format & 16) output = <code>{output}</code>
  if (format & 8) output = <u>{output}</u>
  if (format & 4) output = <s>{output}</s>
  if (format & 2) output = <em>{output}</em>
  if (format & 1) output = <strong>{output}</strong>
  return output
}
