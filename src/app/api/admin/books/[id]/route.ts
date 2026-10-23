import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext } from '@/lib/serverAuth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const deleteLessons = searchParams.get('deleteLessons') === 'true';
    const session = await getSessionContext();

    const book = await prisma.bookReference.findUnique({
      where: { id },
      include: { _count: { select: { lessons: true } } },
    });
    if (!book) {
      return NextResponse.json({ error: 'Livre introuvable' }, { status: 404 });
    }

    if (!session.isAdmin && book.ownerId !== session.userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que les livres que vous avez vous-même importés.' },
        { status: 403 }
      );
    }

    if (book._count.lessons > 0 && !deleteLessons) {
      return NextResponse.json(
        {
          error: `Ce livre est lié à ${book._count.lessons} leçon(s). Ajoutez ?deleteLessons=true pour les supprimer aussi.`,
          lessonsCount: book._count.lessons,
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (deleteLessons && book._count.lessons > 0) {
        // Les sessions référencent les leçons : suppression en cascade manuelle.
        await tx.userSession.deleteMany({ where: { lesson: { bookReferenceId: id } } });
        await tx.lesson.deleteMany({ where: { bookReferenceId: id } });
      }
      await tx.bookReference.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, deletedLessons: deleteLessons ? book._count.lessons : 0 });
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json({ error: 'Échec de la suppression du livre' }, { status: 500 });
  }
}
