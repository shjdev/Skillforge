import type { Metadata } from 'next';
import { PageContainer } from '@/components/ui/page-header';
import { TodayView } from '@/components/today/TodayView';

export const metadata: Metadata = { title: 'Aujourd’hui' };

export default function DashboardPage() {
  return (
    <PageContainer>
      <TodayView />
    </PageContainer>
  );
}
