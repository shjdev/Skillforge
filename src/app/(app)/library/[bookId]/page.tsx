import type { Metadata } from 'next';
import { PageContainer } from '@/components/ui/page-header';
import { BookView } from '@/components/library/BookView';

export const metadata: Metadata = { title: 'Livre' };

export default async function BookPage({ params }: PageProps<'/library/[bookId]'>) {
  const { bookId } = await params;
  return (
    <PageContainer>
      <BookView bookId={bookId} />
    </PageContainer>
  );
}
