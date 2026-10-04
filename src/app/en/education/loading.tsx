import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'education'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/education" route={['en', 'education']} variant="education" />
}
