import type { Metadata } from 'next';
import { PageContainer } from '@/components/ui/page-header';
import { LearnView } from '@/components/learn/LearnView';

export const metadata: Metadata = { title: 'Apprendre' };

export default async function LearnPage({ params }: PageProps<'/learn/[topicSlug]'>) {
  const { topicSlug } = await params;
  return (
    <PageContainer className="max-w-6xl">
      <LearnView slug={topicSlug} />
    </PageContainer>
  );
}
