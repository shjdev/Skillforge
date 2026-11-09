import type { Metadata } from 'next';
import { PageContainer } from '@/components/ui/page-header';
import { LibraryView } from '@/components/library/LibraryView';

export const metadata: Metadata = { title: 'Bibliothèque' };

export default function LibraryPage() {
  return (
    <PageContainer>
      <LibraryView />
    </PageContainer>
  );
}
