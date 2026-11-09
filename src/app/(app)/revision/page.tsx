import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { RevisionView } from '@/components/revision/RevisionView';

export const metadata: Metadata = { title: 'Révision' };

export default function RevisionPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader kicker="Révision" title="Relire vos leçons" description="Toutes les leçons que vous avez terminées, et une recherche dans leur contenu." />
      <Suspense>
        <RevisionView />
      </Suspense>
    </PageContainer>
  );
}
