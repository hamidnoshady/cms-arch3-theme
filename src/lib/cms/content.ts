import 'server-only'

import { cache } from 'react'

import { SECTIONS, blogExclusion, categorySubtree, resolveSectionRef, type SectionKey, type SectionRef } from '@/lib/theme/sections'
import { articlePath, educationEntryPath, projectPath } from '@/lib/routing/paths'

import type { SiteContext } from './context'
import {
  getCategories,
  getPageById,
  getPageBySlug,
  getPostBySlug,
  getPosts,
  getPostsByIds,
  type SearchHit,
} from './endpoints'
import type { CategoryDoc, FindResult, PageDoc, PostDoc } from './types'
import type { QueryParams } from './client'

/** Binding/slug resolution for one section, plus the documents it points at. */

export type PageSection = 'about' | 'contact' | 'home'
export type CategorySection = 'blog' | 'education' | 'projects'

export type CategoryIndex = {
  all: CategoryDoc[]
  byId: Map<string, CategoryDoc>
  bySlug: Map<string, CategoryDoc>
  subtreeIds: (rootId: string) => string[]
  rootIdOf: (categoryId: string) => string
}

export const getCategoryIndex = cache(async (locale: string, draft: boolean): Promise<CategoryIndex> => {
  const all = await getCategories(locale as never, draft)
  const byId = new Map(all.map((category) => [String(category.id), category]))
  const bySlug = new Map(all.map((category) => [category.slug, category]))

  const parentIdOf = (category: CategoryDoc): null | string => {
    const parent = category.parent
    if (!parent) return null
    if (typeof parent === 'string') return parent
    return String(parent.id)
  }

  return {
    all,
    byId,
    bySlug,
    rootIdOf: (categoryId: string) => {
      let current = byId.get(categoryId)
      const seen = new Set<string>()
      while (current) {
        const parentId = parentIdOf(current)
        if (!parentId || seen.has(parentId)) break
        seen.add(parentId)
        const parent = byId.get(parentId)
        if (!parent) return parentId
        current = parent
      }
      return current ? String(current.id) : categoryId
    },
    subtreeIds: (rootId: string) => {
      const root = byId.get(rootId)
      if (!root) return [rootId]
      return [rootId, ...categorySubtree(root, all).map((category) => String(category.id))]
    },
  }
})

export const getSectionRef = (section: SectionKey, ctx: SiteContext): SectionRef =>
  resolveSectionRef(section, ctx.site.themeRuntime?.bindings)

/** A page slot: bound id wins, slug is the unbound hint, `null` means unbound. */
export const getSectionPage = async (
  section: PageSection,
  ctx: SiteContext,
): Promise<{ page: null | PageDoc; ref: SectionRef }> => {
  const ref = getSectionRef(section, ctx)
  if (ref.by === 'binding') {
    return { page: await getPageById(ref.id, ctx.locale, ctx.draft), ref }
  }
  if (ref.by === 'slug') {
    return { page: await getPageBySlug(ref.slug, ctx.locale, ctx.draft), ref }
  }
  return { page: null, ref }
}

export type SectionCategory = {
  /** Bound/hinted root category; `null` for an unbound blog (all posts). */
  root: null | CategoryDoc
  /** Direct children, used as the archive's filter controls. */
  children: CategoryDoc[]
  /** Category ids excluded from the blog when no blog category is bound. */
  excludedIds: string[]
  ref: SectionRef
}

export const getSectionCategories = async (section: CategorySection, ctx: SiteContext): Promise<SectionCategory> => {
  const index = await getCategoryIndex(ctx.locale, ctx.draft)
  const ref = getSectionRef(section, ctx)
  const root =
    ref.by === 'binding'
      ? index.byId.get(ref.id) ?? null
      : ref.by === 'slug'
        ? index.bySlug.get(ref.slug) ?? null
        : null

  if (section === 'blog') {
    const projectsRef = getSectionRef('projects', ctx)
    const educationRef = getSectionRef('education', ctx)
    const excludedRoots = [projectsRef, educationRef]
      .map((entry) =>
        entry.by === 'binding'
          ? index.byId.get(entry.id)
          : entry.by === 'slug'
            ? index.bySlug.get(entry.slug)
            : undefined,
      )
      .filter((category): category is CategoryDoc => Boolean(category))
    const excludedIds = blogExclusion(
      index.all,
      excludedRoots.map((category) => String(category.id)),
    )
    const excluded = new Set(excludedIds)
    // A bound blog category behaves like the other archive roots: its direct children
    // are the filters. With no blog category bound the archive is "everything outside
    // the project/education subtrees", so the applicable controls are the top-level
    // categories that remain inside that scope — not an always-empty filter group.
    const children = root
      ? index.all.filter((category) => idOf(category.parent) === String(root.id))
      : index.all.filter((category) => !idOf(category.parent) && !excluded.has(String(category.id)))
    return { children, excludedIds, ref, root }
  }

  return {
    children: root ? index.all.filter((category) => idOf(category.parent) === String(root.id)) : [],
    excludedIds: [],
    ref,
    root,
  }
}

const idOf = (value: unknown): null | string => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    return typeof id === 'string' ? id : null
  }
  return null
}

export type ArchiveOptions = {
  categorySlug?: null | string
  limit?: number
  page?: number
  section: CategorySection
}

/** One query shape for all three archives, with the section filter applied. */
export const getArchive = async (
  ctx: SiteContext,
  options: ArchiveOptions,
): Promise<FindResult<PostDoc>> => {
  const { section, page = 1, limit = 12, categorySlug } = options
  const sectionData = await getSectionCategories(section, ctx)
  const index = await getCategoryIndex(ctx.locale, ctx.draft)

  let where: QueryParams = {}

  if (categorySlug) {
    const filter = index.bySlug.get(categorySlug)
    if (!filter) return emptyPage(page, limit)
    const allowed = allowedCategoryIds(sectionData, index)
    const scoped = index.subtreeIds(String(filter.id)).filter((id) => allowed.has(id))
    // A category that belongs to another section (a project category asked of the
    // blog, an education workshop asked of projects) is not a filter this archive can
    // honour: the query yields the empty state instead of silently crossing sections.
    if (scoped.length === 0) return emptyPage(page, limit)
    where = { categories: { in: scoped } }
  } else if (sectionData.root) {
    where = { categories: { in: index.subtreeIds(String(sectionData.root.id)) } }
  } else if (section === 'blog' && sectionData.excludedIds.length > 0) {
    // Posts outside the projects/education subtrees, plus posts with no category.
    where = {
      or: [
        { categories: { not_in: sectionData.excludedIds } },
        { categories: { exists: false } },
      ],
    }
  }

  return getPosts(ctx.locale, { limit, page, where }, ctx.draft)
}

/** The category ids an archive may show, so `?category=` can only ever narrow it. */
const allowedCategoryIds = (sectionData: SectionCategory, index: CategoryIndex): Set<string> => {
  if (sectionData.root) return new Set(index.subtreeIds(String(sectionData.root.id)))
  const allowed = new Set(index.all.map((category) => String(category.id)))
  for (const id of sectionData.excludedIds) allowed.delete(id)
  return allowed
}

const emptyPage = (page: number, limit: number): FindResult<PostDoc> => ({
  docs: [],
  hasNextPage: false,
  hasPrevPage: false,
  limit,
  nextPage: null,
  page,
  prevPage: null,
  totalDocs: 0,
  totalPages: 0,
})

/** Which section a post belongs to — decides its canonical URL. */
export const postSection = async (
  post: PostDoc,
  ctx: SiteContext,
): Promise<CategorySection> => {
  const index = await getCategoryIndex(ctx.locale, ctx.draft)
  const ids = (post.categories ?? []).map((entry) => idOf(entry)).filter((id): id is string => Boolean(id))
  const roots = new Set(ids.map((id) => index.rootIdOf(id)))

  for (const section of ['projects', 'education'] as const) {
    const sectionData = await getSectionCategories(section, ctx)
    if (sectionData.root && roots.has(String(sectionData.root.id))) return section
  }
  return 'blog'
}

export const postHref = async (post: PostDoc, ctx: SiteContext): Promise<string> => {
  const section = await postSection(post, ctx)
  if (section === 'projects') return projectPath(post.slug)
  if (section === 'education') return educationEntryPath(post.slug)
  return articlePath(post.slug)
}

export const getPostContext = async (
  slug: string,
  ctx: SiteContext,
): Promise<{
  post: PostDoc
  section: CategorySection
  related: PostDoc[]
  siblings: CategoryDoc[]
} | null> => {
  const post = await getPostBySlug(slug, ctx.locale, ctx.draft)
  if (!post) return null
  const section = await postSection(post, ctx)
  const index = await getCategoryIndex(ctx.locale, ctx.draft)
  const relatedIds = (post.relatedPosts ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry.id))
    .filter((id): id is string => Boolean(id))
  const related = relatedIds.length
    ? (await getPostsByIds(relatedIds, ctx.locale, ctx.draft)).slice(0, 3)
    : []
  const siblings = (post.categories ?? [])
    .map((entry) => idOf(entry))
    .map((id) => (id ? index.byId.get(id) : undefined))
    .filter((category): category is CategoryDoc => Boolean(category))
  return { post, related, section, siblings }
}

export const previewSearch = (hits: SearchHit[]): SearchHit[] => hits.slice(0, 20)

/**
 * Canonical href per search hit.
 *
 * The search index returns hits, not sections: every hit is resolved through the same
 * `postSection` rule the archives use, so a project hit links to `/projects/<slug>`
 * and an education hit to `/education/<slug>` instead of every hit being presented as
 * a blog article. One batched read resolves the hit documents (`doc.value` is the
 * source document id when the CMS populates it, the hit id otherwise); only the hits
 * that batch misses fall back to a per-slug read.
 */
export const searchHrefs = async (
  hits: SearchHit[],
  ctx: SiteContext,
): Promise<Map<string, string>> => {
  const resolved = new Map<string, string>()
  if (hits.length === 0) return resolved

  const documentId = (hit: SearchHit): string => hit.doc?.value ?? hit.id
  const ids = [...new Set(hits.map(documentId))]
  const posts = await getPostsByIds(ids, ctx.locale, ctx.draft)
  const byId = new Map(posts.map((post) => [String(post.id), post]))

  await Promise.all(
    hits.map(async (hit) => {
      const post = byId.get(documentId(hit)) ?? (await getPostBySlug(hit.slug, ctx.locale, ctx.draft))
      if (post) resolved.set(hit.id, await postHref(post, ctx))
    }),
  )
  return resolved
}

export const sectionRootCategory = async (
  section: CategorySection,
  ctx: SiteContext,
): Promise<null | CategoryDoc> => (await getSectionCategories(section, ctx)).root

export const SECTION_KEYS: SectionKey[] = ['home', 'about', 'contact', 'projects', 'education', 'blog']
export const SECTION_RULES = SECTIONS
