import { BlogIndexView, blogMetadata } from '@/views/BlogIndexView'

type SearchParams = Promise<{ category?: string; page?: string }>

export const generateMetadata = async ({ searchParams }: { searchParams: SearchParams }) => {
  const { category, page } = await searchParams
  return blogMetadata('fa', Number(page ?? 1) || 1, category)
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { category, page } = await searchParams
  return <BlogIndexView category={category ?? null} locale="fa" page={Number(page ?? 1) || 1} />
}
