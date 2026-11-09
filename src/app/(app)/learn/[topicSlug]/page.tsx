import type { Metadata } from 'next';
import { PageContainer } from '@/components/ui/page-header';
import { LearnView } from '@/components/learn/LearnView';

export const metadata: Metadata = { title: 'Apprendre' };

export default async function LearnPage({ params, searchParams }: PageProps<'/learn/[topicSlug]'>) {
  const { topicSlug } = await params;
  const { lesson } = await searchParams;
  return (
    <PageContainer className="max-w-6xl">
      <LearnView slug={topicSlug} initialLessonId={typeof lesson === 'string' ? lesson : undefined} />
    </PageContainer>
  );
}
