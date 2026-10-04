import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'blog'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/blog" route={['en', 'blog']} variant="detail" />
}
