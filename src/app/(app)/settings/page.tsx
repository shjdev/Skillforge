import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { SettingsView } from '@/components/settings/SettingsView';

export const metadata: Metadata = { title: 'Réglages' };

export default function SettingsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader kicker="Réglages" title="Votre espace" description="Votre nom, votre rythme d’apprentissage et vos préférences." />
      <SettingsView />
    </PageContainer>
  );
}
