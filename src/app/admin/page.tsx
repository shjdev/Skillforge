import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { AdminView } from '@/components/admin/AdminView';

export const metadata: Metadata = { title: 'Administration' };

export default function AdminPage() {
  return (
    <PageContainer>
      <PageHeader kicker="Administration" title="Profils et activité" description="Qui utilise SkillForge, ce qu’ils importent et ce qu’ils apprennent." />
      <AdminView />
    </PageContainer>
  );
}
