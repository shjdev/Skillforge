import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { LessonSchema } from '@/lib/schemas/admin.schema';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = LessonSchema.parse(body);

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        topicId: validatedData.topicId,
        title: validatedData.title,
        contentMd: validatedData.contentMd,
        dayNumber: validatedData.dayNumber,
        sessionType: validatedData.sessionType,
        difficultyLevel: validatedData.difficultyLevel,
        durationMinutes: validatedData.durationMinutes,
        keyConcepts: JSON.stringify(validatedData.keyConcepts),
        bookReferenceId: validatedData.bookReferenceId || null,
        chapterCitation: validatedData.chapterCitation || null,
      },
    });

    return NextResponse.json(lesson);
  } catch (error) {
    console.error('Error updating lesson:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.lesson.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    return NextResponse.json({ error: 'Échec de la suppression de la leçon' }, { status: 500 });
  }
}
