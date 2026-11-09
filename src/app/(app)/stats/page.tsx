import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { StatsView } from '@/components/stats/StatsView';

export const metadata: Metadata = { title: 'Statistiques' };

export default function StatsPage() {
  return (
    <PageContainer>
      <PageHeader kicker="Statistiques" title="Votre progression" />
      <StatsView />
    </PageContainer>
  );
}
