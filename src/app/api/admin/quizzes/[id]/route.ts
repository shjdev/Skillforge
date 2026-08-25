import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { QuizSchema } from '@/lib/schemas/admin.schema';

const QuizUpdateSchema = QuizSchema.partial();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = QuizUpdateSchema.parse(body);

    const quiz = await prisma.quiz.update({
      where: { id },
      data: {
        ...(validatedData.title !== undefined ? { title: validatedData.title } : {}),
        ...(validatedData.passingScore !== undefined ? { passingScore: validatedData.passingScore } : {}),
        ...(validatedData.quizType !== undefined ? { quizType: validatedData.quizType } : {}),
      },
    });

    return NextResponse.json(quiz);
  } catch (error) {
    console.error('Error updating quiz:', error);
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
    await prisma.quiz.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    return NextResponse.json({ error: 'Échec de la suppression du quiz' }, { status: 500 });
  }
}
