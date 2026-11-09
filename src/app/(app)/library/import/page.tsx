import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { ImportFlow } from '@/components/import/ImportFlow';

export const metadata: Metadata = { title: 'Importer un livre' };

export default function ImportPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        kicker="Bibliothèque"
        title="Importer un livre"
        description="Déposez un livre ou un cours : SkillForge en tire un parcours de leçons quotidiennes, organisé en thèmes et validé par des quiz."
      />
      <Suspense>
        <ImportFlow />
      </Suspense>
    </PageContainer>
  );
}
