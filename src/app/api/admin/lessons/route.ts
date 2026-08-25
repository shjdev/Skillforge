import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { LessonSchema } from '@/lib/schemas/admin.schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = LessonSchema.parse(body);

    const lesson = await prisma.lesson.create({
      data: {
        topicId: validatedData.topicId,
        title: validatedData.title,
        contentMd: validatedData.contentMd,
        dayNumber: validatedData.dayNumber,
        sessionType: validatedData.sessionType,
        difficultyLevel: validatedData.difficultyLevel,
        durationMinutes: validatedData.durationMinutes,
        keyConcepts: JSON.stringify(validatedData.keyConcepts),
        contentSource: 'manual',
        bookReferenceId: validatedData.bookReferenceId || null,
        chapterCitation: validatedData.chapterCitation || null,
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    console.error('Error creating lesson:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
